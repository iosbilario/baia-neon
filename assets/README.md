# Recursos originais de Baía Neon

O pacote inclui 16 texturas PNG, 9 modelos GLB, 9 sons WAV e um ícone SVG. Todos foram construídos por fórmulas, formas geométricas e síntese sonora no gerador local. Nenhuma fotografia, gravação, marca de veículo ou modelo de terceiros foi usado.

## Uso

As texturas têm 128 por 128 pixels. As superfícies repetíveis têm bordas iguais. `palm_leaf.png` tem transparência e pede material com recorte alfa e duas faces. `windows_day.png`, `windows_night.png` e `windows_emissive.png` compartilham as posições das janelas.

Os modelos usam o formato binário glTF 2.0, materiais PBR, metros, eixo Y para cima e frente no sentido positivo de Z, igual ao jogo. Um nó raiz com rotação de 180 graus em Y faz essa orientação sem alterar a geometria local das partes. Preserve esse nó ao importar. Cada parte tem um nó próprio. Não há rig de animação nem animações gravadas. Rodas e membros podem ser animados por código após ajuste de pivôs.

Os sons são WAV PCM mono, 16 bits, 22.050 Hz. O catálogo indica quais podem repetir. A faixa `cinematic_original.wav` tem 12 segundos e composição procedural original. O motor pode variar de altura por `playbackRate`.

O protótipo pode criar suas formas em JavaScript e seus sons por Web Audio. Os arquivos exportados são recursos para expansão e não implicam que todos já estejam carregados pelo jogo. Consulte o código do protótipo para o uso atual.

`preview.png` mostra as texturas e vistas dos modelos. Não é uma captura do jogo.

## Recriar

Execute a partir da raiz do projeto, com Python 3, NumPy e Pillow já instalados.

```sh
python3 tools/generate_assets.py
```

O jogo não precisa de Python, NumPy ou Pillow. Eles são usados apenas para recriar os arquivos. A semente fixa é `52026`. O arquivo `manifest.json` registra cada recurso, tamanho, resumo de origem e SHA-256.

Para verificar o catálogo e os arquivos locais, execute com Python 3 e Pillow.

```sh
python3 tools/validate_assets.py
```

A verificação confere hashes, bordas das texturas repetíveis, frames de áudio e intervalos dos buffers e accessors GLB. Nenhuma etapa faz acesso à internet.

## Licença dos recursos

Os recursos originais desta pasta são disponibilizados sob CC0-1.0, nos limites dos direitos aplicáveis ao material gerado. Não há obrigação de atribuição. O código do gerador segue a licença de código declarada na raiz do projeto.

Modelos, texturas e sons não reproduzem assets da Rockstar nem de outro jogo. O nome de trabalho e eventuais nomes comerciais novos não foram submetidos a pesquisa de registro de marca.
