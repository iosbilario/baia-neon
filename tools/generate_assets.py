#!/usr/bin/env python3
"""Rebuild original Baia Neon assets, offline. Requires Python 3, NumPy and Pillow."""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
SEED = 52026
RNG = np.random.default_rng(SEED)
SIZE = 128
entries = []
preview_models = {}


def entry(path, kind, **kw):
    entries.append(dict(path=str(path.relative_to(ASSETS)), kind=kind,
                        bytes=path.stat().st_size,
                        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        license='CC0-1.0', source='Original procedural generation', **kw))


def save_texture(name, arr, tile=True, description=''):
    p = ASSETS / 'textures' / (name + '.png')
    # Matching border pixels make repeating edges continuous.
    if tile:
        arr[:, -1] = arr[:, 0]
        arr[-1, :] = arr[0, :]
    Image.fromarray(np.uint8(np.clip(arr, 0, 255))).save(p, optimize=True)
    entry(p, 'texture', width=arr.shape[1], height=arr.shape[0],
          seamless=tile, color_space='sRGB' if name != 'windows_emissive' else 'linear',
          description=description)


def noise_texture(base, grain=7):
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    # Periodic variations plus deterministic grain, then shared border.
    broad = np.sin(xx * 2 * np.pi / SIZE) * np.cos(yy * 4 * np.pi / SIZE)
    n = RNG.normal(0, grain, (SIZE, SIZE)) + broad * grain * .5
    return np.array(base)[None, None, :] + n[:, :, None]


def textures():
    for name, base, grain in [
        ('asphalt', (48, 53, 62), 8), ('sidewalk', (184, 179, 169), 4),
        ('stucco_coral', (219, 126, 119), 3), ('stucco_mint', (127, 191, 176), 3),
        ('stucco_cream', (237, 221, 184), 3), ('sand', (226, 199, 147), 6),
        ('grass', (64, 112, 75), 10), ('roof', (69, 80, 88), 4)]:
        a = noise_texture(base, grain)
        if name == 'sidewalk':
            a[::32, :] *= .65
            a[:, ::32] *= .65
        save_texture(name, a, description='Original repeating surface')
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    wavelets = 7 * np.sin((xx + yy * 2) * 2 * np.pi / SIZE) + 4 * np.cos((xx * 3 - yy) * 2 * np.pi / SIZE)
    a = np.array([33, 146, 153])[None, None, :] + wavelets[:, :, None]
    save_texture('water', a, description='Stylized repeating water, no photographic source')
    a = noise_texture((119, 81, 53), 4)
    a += (8 * np.sin(xx * 24 * np.pi / SIZE) + 4 * np.cos(yy * 6 * np.pi / SIZE))[:, :, None]
    save_texture('bark', a)
    a = noise_texture((159, 94, 77), 4)
    for y in range(SIZE):
        a[y, :] = a[y, :] * (.60 if y % 16 < 2 else 1)
        off = 16 if (y // 16) % 2 else 0
        for x in range(SIZE):
            if (x + off) % 32 < 2: a[y, x] *= .65
    save_texture('brick', a)
    a = noise_texture((47, 52, 60), 4)
    a[:, 46:50] = (244, 212, 110)
    a[:, 78:82] = (244, 212, 110)
    save_texture('road_double_yellow', a)
    day = np.full((SIZE, SIZE, 3), (133, 161, 164), dtype=np.uint8)
    night = np.full((SIZE, SIZE, 3), (27, 39, 56), dtype=np.uint8)
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    for y in range(8, SIZE, 32):
        for x in range(8, SIZE, 32):
            day[y:y+21, x:x+16] = (47, 91, 106)
            day[y:y+2, x:x+16] = (125, 179, 183)
            night[y:y+21, x:x+16] = (38, 59, 79)
            if RNG.random() < .65:
                c = (255, 203, 121) if RNG.random() < .8 else (162, 227, 225)
                night[y:y+21, x:x+16] = c
                emissive[y:y+21, x:x+16] = c
    save_texture('windows_day', day)
    save_texture('windows_night', night)
    save_texture('windows_emissive', emissive, description='Emission mask aligned to windows_day')
    leaf = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(leaf)
    d.line((12, 115, 115, 12), fill=(80, 135, 63, 255), width=3)
    for i in range(12, 108, 7):
        t = (i - 12) / 96
        w = 25 * math.sin(math.pi * t)
        x, y = 12 + i * .85, 115 - i * .85
        d.polygon([(x, y), (x-15-w, y-5), (x-3, y+2)], fill=(42, 117+int(t*30), 66, 255))
        d.polygon([(x, y), (x+5, y+15+w), (x+3, y-2)], fill=(61, 146, 78, 255))
    save_texture('palm_leaf', np.array(leaf), False, 'Alpha-cutout frond, double-sided material')


SR = 22050


def save_audio(name, signal, loop=False, description=''):
    a = np.asarray(signal, dtype=float)
    peak = max(1.0, float(np.abs(a).max()))
    a = np.clip(a / peak, -.95, .95)
    if not loop:
        n = min(int(.015 * SR), len(a)//4)
        a[:n] *= np.linspace(0, 1, n)
        a[-n:] *= np.linspace(1, 0, n)
    else:
        n = min(int(.035 * SR), len(a)//6)
        # Crossfade both ends around a shared periodic seam, preserving length.
        mix = np.linspace(0, 1, n)
        seam = a[-n:] * (1-mix) + a[:n] * mix
        a[-n:] = seam
        a[:n] = seam
        a[-1] = a[0]
    p = ASSETS / 'audio' / (name + '.wav')
    with wave.open(str(p), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype('<i2').tobytes())
    entry(p, 'audio', sample_rate=SR, channels=1, bits=16,
          seconds=round(len(a)/SR, 3), loop=loop, description=description)


def sounds():
    t = np.arange(SR*2)/SR
    engine = .23*np.sin(2*np.pi*55*t) + .11*np.sin(2*np.pi*110*t) + .07*np.sin(2*np.pi*165*t)
    engine += .04 * RNG.normal(size=len(t)) * (.4+.6*np.sin(2*np.pi*27.5*t)**2)
    save_audio('engine_idle', engine, True, 'Pitch with playbackRate for acceleration')
    t = np.arange(SR*4)/SR
    phase = 2*np.pi*(660*t + 155/(2*np.pi*.5)*(-np.cos(2*np.pi*.5*t)+1))
    save_audio('siren', .28*np.sin(phase)+.04*np.sin(phase*2), True, 'Generic synthesized sweep, not a real service recording')
    t = np.arange(SR*3)/SR
    rain = RNG.normal(size=len(t))*.13
    rain = np.convolve(rain, np.array([.18,.25,.25,.2,.12]), 'same')
    save_audio('rain', rain, True)
    t = np.arange(SR*5)/SR
    sea = np.convolve(RNG.normal(size=len(t)), np.ones(25)/25, 'same')
    sea *= (.3+.25*np.sin(2*np.pi*.2*t))
    save_audio('surf', sea, True)
    t = np.arange(int(SR*.24))/SR
    step = RNG.normal(size=len(t))*.23*np.exp(-t*34)+.20*np.sin(2*np.pi*90*t)*np.exp(-t*26)
    save_audio('footstep', step)
    t = np.arange(int(SR*.65))/SR
    save_audio('horn', .18*np.sin(2*np.pi*330*t)+.15*np.sin(2*np.pi*415*t))
    t = np.arange(int(SR*.18))/SR
    save_audio('ui_confirm', .18*np.sin(2*np.pi*(660*t+880*t*t))*np.exp(-t*10))
    t = np.arange(int(SR*.45))/SR
    save_audio('impact', .3*RNG.normal(size=len(t))*np.exp(-t*20) + .3*np.sin(2*np.pi*52*t)*np.exp(-t*13))
    t = np.arange(SR*12)/SR
    cue = np.zeros_like(t)
    for start, freqs in [(0,[130.813,195.998,261.626]),(3,[116.541,174.614,233.082]),(6,[103.826,155.563,207.652]),(9,[130.813,195.998,293.665])]:
        u = t-start
        env = np.where((u>=0)&(u<3.2), np.minimum(1,np.maximum(0,u)*2)*np.exp(-np.maximum(0,u)*.38), 0)
        for f in freqs: cue += env*(.055*np.sin(2*np.pi*f*t)+.018*np.sin(2*np.pi*f*2*t))
    for start in np.arange(0, 12, .5):
        u=t-start
        env=np.where(u>=0,np.exp(-np.maximum(0,u)*30),0)
        cue += .10*np.sin(2*np.pi*(48*u+18*(1-np.exp(-np.maximum(u,0)*8))))*env
    save_audio('cinematic_original', cue, False, 'Original synthesized twelve-second cue, no sampled composition')


def v3(v): return np.asarray(v, dtype=float)


class Model:
    def __init__(self, name): self.name, self.parts = name, []

    def triangles(self, name, verts, faces, color, translation=(0,0,0), rotation=None):
        verts=np.asarray(verts,dtype=float)
        if rotation is not None: verts=verts @ np.array(rotation).T
        verts += np.array(translation)
        out=[]
        norms=[]
        for a,b,c in faces:
            p,q,r=verts[a],verts[b],verts[c]
            n=np.cross(q-p,r-p)
            n=n/(np.linalg.norm(n) or 1)
            out.extend([p,q,r])
            norms.extend([n,n,n])
        self.parts.append((name,np.asarray(out,dtype='<f4'),np.asarray(norms,dtype='<f4'),color))

    def box(self, name, center, size, color, rot=None):
        sx,sy,sz=np.array(size)/2
        vs=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]]
        fs=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(3,7,6),(3,6,2),(0,4,7),(0,7,3),(1,2,6),(1,6,5)]
        self.triangles(name,vs,fs,color,center,rot)

    def cylinder(self, name, center, radius, height, color, sides=8, top=None, axis='y'):
        top=radius if top is None else top
        vs=[]
        for y,r in [(-height/2,radius),(height/2,top)]:
            vs += [[r*math.cos(i*2*math.pi/sides),y,r*math.sin(i*2*math.pi/sides)] for i in range(sides)]
        vs += [[0,-height/2,0],[0,height/2,0]]
        fs=[]
        for i in range(sides):
            j=(i+1)%sides
            fs += [(i,j,j+sides),(i,j+sides,i+sides),(2*sides,j,i),(2*sides+1,i+sides,j+sides)]
        rot=([[0,1,0],[-1,0,0],[0,0,1]] if axis=='x' else None)
        self.triangles(name,vs,fs,color,center,rot)

    def ellipsoid(self,name,center,size,color,rings=4,segs=8):
        vs=[]
        for j in range(rings+1):
            lat=math.pi*j/rings
            for i in range(segs):
                lng=2*math.pi*i/segs
                vs.append([math.sin(lat)*math.cos(lng)*size[0], math.cos(lat)*size[1], math.sin(lat)*math.sin(lng)*size[2]])
        fs=[]
        for j in range(rings):
            for i in range(segs):
                a=j*segs+i
                b=j*segs+(i+1)%segs
                c=(j+1)*segs+i
                d=(j+1)*segs+(i+1)%segs
                if j>0: fs.append((a,c,b))
                if j<rings-1: fs.append((b,c,d))
        self.triangles(name,vs,fs,color,center)


def ry(a):
    c,s=math.cos(a),math.sin(a)
    return [[c,0,s],[0,1,0],[-s,0,c]]


def glb(model):
    blob=bytearray()
    views=[]
    access=[]
    materials=[]
    meshes=[]
    nodes=[]
    def append_array(a, typ, component, bounds=False):
        while len(blob)%4: blob.append(0)
        idx=len(views)
        views.append(dict(buffer=0,byteOffset=len(blob),byteLength=a.nbytes,target=34962))
        blob.extend(a.tobytes())
        ac=dict(bufferView=idx,componentType=component,count=len(a),type=typ)
        if bounds:
            ac.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        access.append(ac)
        return len(access)-1
    triangles=0
    for name, pos, norm, color in model.parts:
        pi=append_array(pos,'VEC3',5126,True)
        ni=append_array(norm,'VEC3',5126)
        rgba=list(color)+([1] if len(color)==3 else [])
        materials.append(dict(name=name+'_mat',pbrMetallicRoughness=dict(baseColorFactor=rgba,metallicFactor=0,roughnessFactor=.8),doubleSided=True))
        meshes.append(dict(name=name,primitives=[dict(attributes=dict(POSITION=pi,NORMAL=ni),material=len(materials)-1,mode=4)]))
        nodes.append(dict(name=name,mesh=len(meshes)-1))
        triangles+=len(pos)//3
    root_index = len(nodes)
    nodes.append(dict(name=model.name+'_root',children=list(range(root_index)),rotation=[0,1,0,0]))
    data=dict(asset=dict(version='2.0',generator='Baia Neon original asset generator'),
              scene=0,scenes=[dict(name=model.name,nodes=[root_index])],
              nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(blob))],
              bufferViews=views,accessors=access,
              extras=dict(license='CC0-1.0',units='meters',up='Y',forward='+Z',seed=SEED))
    js=json.dumps(data,separators=(',',':')).encode()
    js += b' ' * ((-len(js))%4)
    blob += b'\x00' * ((-len(blob))%4)
    p=ASSETS/'models'/(model.name+'.glb')
    p.write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(blob))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\x00')+blob)
    entry(p,'model',format='glTF 2.0 GLB',triangles=triangles,nodes=len(nodes),up='Y',forward='+Z',units='meters')
    preview_models[model.name]=model


def car(name,police=False):
    m=Model(name)
    body=(.14,.54,.60) if not police else (.89,.90,.86)
    dark=(.09,.13,.18)
    m.box('body',(0,.65,0),(1.8,.65,3.8),body)
    m.box('hood',(0,1,-1.15),(1.72,.24,1.2),body)
    m.box('roof',(0,1.42,.15),(1.48,.12,1.65),body if not police else dark)
    m.box('cabin',(0,1.21,.15),(1.48,.38,1.65),(.13,.27,.34))
    for x in [-.78,.78]:
        m.box('pillar',(x,1.23,.15),(.08,.45,.13),body)
        m.box('mirror',(x*1.23,1.1,-.45),(.25,.13,.17),body)
    m.box('bumper_front',(0,.53,-1.97),(1.85,.2,.16),dark)
    m.box('bumper_rear',(0,.53,1.97),(1.85,.2,.16),dark)
    for x in [-.58,.58]:
        m.box('headlight',(x,.82,-1.91),(.43,.22,.05),(1,.92,.67))
        m.box('taillight',(x,.82,1.91),(.38,.17,.05),(.89,.21,.24))
    for x in [-.91,.91]:
        for z in [-1.19,1.19]:
            m.cylinder('wheel',(x,.42,z),.39,.21,(.055,.065,.075),10,axis='x')
            m.cylinder('hub',(x+(.115 if x>0 else -.115),.42,z),.19,.025,(.6,.66,.67),8,axis='x')
    if police:
        for x in [-.91,.91]: m.box('side_band',(x,.8,0),(.025,.23,2.2),(.12,.23,.31))
        m.box('lightbar_base',(0,1.56,0),(1.25,.1,.30),dark)
        m.box('light_red',(-.36,1.67,0),(.5,.16,.28),(.95,.12,.17))
        m.box('light_blue',(.36,1.67,0),(.5,.16,.28),(.08,.53,1))
    glb(m)


def person(name,shirt,skin,hat=False):
    m=Model(name)
    m.box('torso',(0,1.13,0),(.48,.63,.27),shirt)
    m.ellipsoid('head',(0,1.68,0),(.205,.235,.19),skin)
    m.box('hair',(0,1.85,.01),(.36,.09,.33),(.11,.085,.08))
    for x in [-.14,.14]:
        m.box('leg',(x,.49,0),(.19,.72,.22),(.12,.17,.25))
        m.box('shoe',(x,.09,-.055),(.23,.16,.36),(.08,.10,.12))
    for x in [-.33,.33]:
        m.box('upper_arm',(x,1.18,0),(.17,.39,.22),shirt)
        m.box('lower_arm',(x,.87,0),(.15,.29,.18),skin)
    for x in [-.07,.07]: m.box('eye',(x,1.70,-.181),(.035,.035,.024),(.09,.09,.1))
    if hat:
        m.cylinder('cap',(0,1.89,0),.23,.14,(.92,.65,.25),8)
        m.box('cap_peak',(0,1.85,-.2),(.36,.03,.18),(.92,.65,.25))
    glb(m)


def models():
    car('compact_car')
    car('patrol_car',True)
    person('player',(.88,.40,.32),(.42,.25,.17),True)
    person('pedestrian',(.37,.66,.59),(.70,.45,.32))
    m=Model('palm')
    m.cylinder('trunk',(0,2.7,0),.24,5.4,(.43,.31,.20),7,top=.16)
    for k in range(8):
        a=k*math.tau/8
        verts=[[0,5.35,0],[.45,5.8,.65],[0,5.65,1.7],[-.45,5.8,.65],[.38,5.25,1.75],[0,4.8,2.8],[-.38,5.25,1.75]]
        m.triangles('frond',verts,[(0,1,2),(0,2,3),(1,4,2),(2,4,5),(2,5,6),(3,2,6)],(.13,.43+(k%2)*.08,.26),rotation=ry(a))
    for k in range(3): m.ellipsoid('coconut',(.24*math.cos(k*2.1),5.1,.24*math.sin(k*2.1)),(.14,.17,.14),(.35,.24,.13))
    glb(m)
    m=Model('dog')
    brown=(.63,.39,.22)
    m.box('body',(0,.54,0),(.34,.35,.75),brown)
    m.box('neck',(0,.68,-.34),(.26,.34,.25),brown)
    m.box('head',(0,.84,-.49),(.30,.29,.35),brown)
    m.box('muzzle',(0,.76,-.71),(.23,.16,.20),(.79,.59,.36))
    m.box('nose',(0,.79,-.82),(.14,.08,.035),(.08,.08,.08))
    for x in [-.14,.14]:
        for z in [-.25,.26]: m.box('leg',(x,.25,z),(.105,.40,.12),brown)
        m.box('ear',(x,.93,-.42),(.09,.24,.15),(.31,.18,.12))
        m.box('eye',(x,.87,-.64),(.04,.04,.035),(.02,.03,.03))
    m.box('tail',(0,.73,.5),(.1,.15,.35),brown)
    glb(m)
    m=Model('gull')
    m.ellipsoid('body',(0,.12,0),(.11,.12,.25),(.92,.92,.86))
    m.ellipsoid('head',(0,.24,-.2),(.08,.09,.09),(.98,.98,.94))
    m.triangles('beak',[[-.035,.23,-.26],[.035,.23,-.26],[0,.20,-.40],[0,.27,-.26]],[(0,1,2),(0,2,3),(3,2,1)],(.91,.63,.17))
    for s in [-1,1]:
        m.triangles('wing',[[s*.05,.14,0],[s*.4,.2,.04],[s*.72,.10,.23],[s*.35,.12,.19]],[(0,1,3),(1,2,3)],(.80,.83,.81))
        m.triangles('wing_tip',[[s*.4,.2,.04],[s*.72,.10,.23],[s*.66,.09,.30]],[(0,1,2)],(.20,.25,.29))
    glb(m)
    m=Model('butterfly')
    m.box('body',(0,.03,0),(.025,.025,.15),(.13,.1,.16))
    for s in [-1,1]:
        m.triangles('wing',[[0,.03,-.02],[s*.20,.06,-.15],[s*.24,.08,.03],[s*.12,.04,.13],[0,.03,.06]],[(0,1,2),(0,2,3),(0,3,4)],(.98,.51,.23))
        m.triangles('wing_mark',[[s*.08,.041,-.015],[s*.16,.066,-.08],[s*.19,.075,.025]],[(0,1,2)],(.16,.15,.24))
    glb(m)
    m=Model('art_deco_building')
    cream=(.88,.80,.63)
    coral=(.82,.43,.39)
    m.box('main',(0,5,0),(10,10,8),cream)
    m.box('central_tower',(0,6,-.3),(3,12,8.4),coral)
    m.box('roof_step',(0,12.2,-.3),(2.2,.5,7.8),cream)
    for y in [1.7,4,6.3,8.6]:
        m.box('belt',(0,y+.65,0),(10.25,.18,8.25),coral)
        for x in [-3.7,-2.2,2.2,3.7]:
            m.box('window',(x,y,-4.015),(1.05,1.3,.04),(.13,.28,.32))
            m.box('window_back',(x,y,4.015),(1.05,1.3,.04),(.13,.28,.32))
    m.box('door',(0,1,-4.52),(1.7,2,.05),(.12,.23,.28))
    m.box('canopy',(0,2.45,-5),(3,.2,1.2),coral)
    glb(m)


def render_model(model, size=220):
    im=Image.new('RGB',(size,size),(22,36,47))
    draw=ImageDraw.Draw(im)
    # Apply the same +Z-facing root rotation as each GLB. Move the preview
    # camera around the opposite side to retain a readable front view.
    root_rotation=np.diag([-1,1,-1])
    a,b=.7+math.pi,-.38
    rot=np.array([[math.cos(a),0,math.sin(a)],[math.sin(b)*math.sin(a),math.cos(b),-math.sin(b)*math.cos(a)],[-math.cos(b)*math.sin(a),math.sin(b),math.cos(b)*math.cos(a)]])
    transformed=[pos@root_rotation.T@rot.T for _,pos,_,_ in model.parts]
    allp=np.concatenate(transformed)
    lo,hi=allp[:,:2].min(axis=0),allp[:,:2].max(axis=0)
    scale=(size-35)/max(hi-lo)
    center=(lo+hi)/2
    tris=[]
    light=np.array([-.4,.8,-.6])
    light/=np.linalg.norm(light)
    for (_,pos,norm,color),t in zip(model.parts,transformed):
        for i in range(0,len(pos),3):
            xy=(t[i:i+3,:2]-center)*scale
            pts=[(size/2+p[0],size/2-p[1]) for p in xy]
            bright=.65+.35*abs(float((norm[i]@root_rotation.T)@light))
            fill=tuple(int(min(255,255*c*bright)) for c in color[:3])
            tris.append((t[i:i+3,2].mean(),pts,fill))
    for _,pts,c in sorted(tris,key=lambda x:x[0],reverse=True): draw.polygon(pts,fill=c)
    return im


def contact_sheet():
    w=1160
    im=Image.new('RGB',(w,1110),(15,26,36))
    d=ImageDraw.Draw(im)
    try:
        title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',30)
        font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
        small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
    except OSError: title=font=small=None
    d.text((24,20),'BAIA NEON',fill=(242,177,137),font=title)
    d.text((26,62),'ASSETS ORIGINAIS  /  CC0-1.0  /  SEM DOWNLOADS',fill=(168,195,199),font=font)
    paths=sorted((ASSETS/'textures').glob('*.png'))
    for i,p in enumerate(paths):
        x=24+(i%8)*142
        y=102+(i//8)*163
        tile=Image.open(p).convert('RGBA')
        base=Image.new('RGBA',(128,128),(38,52,58,255))
        base.alpha_composite(tile)
        im.paste(base.convert('RGB'),(x,y))
        d.text((x,y+134),p.stem,fill=(217,227,225),font=small)
    d.text((24,451),'MODELOS GLB  /  VISTAS ILUSTRATIVAS DO PACOTE',fill=(168,195,199),font=font)
    for i,(name,model) in enumerate(preview_models.items()):
        x=24+(i%5)*226
        y=480+(i//5)*269
        im.paste(render_model(model,210),(x,y))
        d.text((x,y+218),name,fill=(217,227,225),font=font)
    d.text((24,1045),'9 sons WAV sintetizados e gerador reproduzivel incluido',fill=(242,177,137),font=font)
    d.text((24,1073),'As imagens mostram recursos do pacote. Nao sao capturas do jogo.',fill=(168,195,199),font=small)
    p=ASSETS/'preview.png'
    im.save(p,optimize=True)
    entry(p,'preview',description='Texture and model contact sheet, not a game screenshot')


def icon():
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#132734"/>
<circle cx="34" cy="30" r="17" fill="#f0a17f"/>
<path d="M8 38h48v17H8z" fill="#2c787a"/>
<path d="M13 43h38M19 48h27" stroke="#73bbb0" stroke-width="2"/>
<path d="M20 54c4-12 5-22 3-31" fill="none" stroke="#122934" stroke-width="4"/>
<path d="M23 23C14 12 8 20 8 26c5-5 10-5 15-3 1-13 11-13 18-8-8 0-13 4-18 8 11-5 19 2 19 8-8-6-12-7-19-8-4 6-9 8-14 8 3-4 7-7 14-8z" fill="#122934"/>
</svg>
'''
    p=ASSETS/'textures'/'icon.svg'
    p.write_text(svg,encoding='utf-8')
    entry(p,'icon',format='SVG',description='Original sunset and palm icon')


def main():
    for name in ['textures','audio','models']: (ASSETS/name).mkdir(parents=True,exist_ok=True)
    textures()
    sounds()
    models()
    contact_sheet()
    icon()
    manifest=dict(pack='Baia Neon original procedural assets',version=1,seed=SEED,
                  license='CC0-1.0',generator='tools/generate_assets.py',
                  runtime_note='Models and audio exports are reusable expansion resources. The starter may use native geometry and Web Audio synthesis rather than loading each export.',
                  source='No external images, models, audio samples or brand designs were imported.',
                  files=entries)
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(files=len(entries),bytes=sum(e['bytes'] for e in entries),textures=sum(e['kind']=='texture' for e in entries),models=sum(e['kind']=='model' for e in entries),audio=sum(e['kind']=='audio' for e in entries))))


if __name__=='__main__': main()
