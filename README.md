# Baía Neon

Kit local para continuar um jogo 3D no Fable 5.2. Inclui prompt, protótipo, código, texturas, modelos, sons e geradores. A cidade é fictícia, com praia, canal e arquitetura costeira em uma área de cerca de 600 por 600 metros.

## Começar

1. Extraia todo o ZIP.
2. Abra JOGAR_OFFLINE.html no Chrome, Edge ou Firefox de um computador com WebGL habilitado.
3. Assista à abertura ou use Esc para chegar ao menu. Clique em Jogar.
4. Use Som desligado para ativar o áudio. O navegador exige essa ação para iniciar o som.

JOGAR_OFFLINE.html reúne o motor, o jogo, a interface e o ícone num arquivo. Não exige instalação, servidor, conta, npm ou conexão. A versão em arquivos separados está em index.html. Se o navegador restringir arquivos locais separados, use a versão única.

O alvo atual é computador com teclado e mouse. A interface se adapta a telas menores, mas não há controles de toque, suporte a console ou controle Bluetooth.

## Entregar ao Fable

Abra a pasta baia-neon no ambiente de programação usado com Fable 5.2. Cole o conteúdo de PROMPT_FABLE_5_2.md ou peça que o agente leia esse arquivo e siga as instruções. Ele precisa de acesso à pasta e de ferramentas para editar arquivos. Um chat sem acesso aos arquivos terá de receber o ZIP como anexo.

O prompt manda reutilizar esta base, verificar falhas e completar o acabamento. Ele restringe leituras de arquivos grandes, instalações, mudanças de arquitetura e ciclos de revisão sem objetivo. Não promete um custo fixo.

## O que está implementado

| Área | Comportamento da base |
| --- | --- |
| Abertura | Sequência de 18 segundos com três enquadramentos no próprio cenário, legendas, barras de cinema e opção de pular |
| Cidade | Prédios, ruas, semáforos, pontes, canal, praia, parques, palmeiras e placas fictícias. Três vielas de 3 m cortam torres do centro e só o compacto passa. Cinco parques são só para pedestres. Nove estacionamentos têm carros para troca. Palmeiras, bancos, fontes e quiosques são sólidos |
| Personagem | Caminhada, corrida, câmera em terceira pessoa e animação dos membros |
| Veículos | Três modelos com condução própria: compacto ágil e frágil, sedã estável e resistente, esportivo forte e de traseira solta. Há velocidade lateral, então o carro derrapa e o freio de mão solta a traseira. A câmera olha à frente e abre com a velocidade |
| População | 64 pedestres com rotina (calçada, semáforo, esquinas, conversa, parque, corrida, fuga), 14 veículos em circulação e cerca de 30 carros estacionados |
| Combate | Pistola com mira assistida, granadas, explosões em cadeia, sangue e pedestres que morrem |
| Dano | Carros amassam, soltam fumaça, pegam fogo e explodem. O guincho repõe os destroços depois |
| Morte | O jogador pode ser atropelado, baleado ou explodido. Tela em câmera lenta com SE FUDEU e alta no ponto inicial |
| Polícia | Patrulha, chamado por infração, perseguição, visão bloqueada por prédios, busca e captura. Só é acionada quando um policial vê o crime ou uma testemunha termina a ligação. Os policiais descem da viatura para prender, atiram a partir de duas estrelas quando houve violência, a segunda viatura tenta interceptar adiante, e voltam ao carro se o suspeito some |
| Testemunhas | Quem viu o crime liga para a polícia com um marcador amarelo sobre a cabeça. Derrubar a testemunha antes do fim da ligação cancela a denúncia |
| Procurado | Estrelas por gravidade acumulada: um crime leve dá uma estrela e cada estrela seguinte exige bem mais violência. Respondem tantas viaturas quantas estrelas, e os reforços chegam um a um |
| Fuga | Exige ficar fora de vista a mais de 40 metros da última posição vista por 16 segundos com uma estrela, mais 5 por estrela extra. Na busca as estrelas piscam e cada viatura só enxerga um cone à frente, desenhado no minimapa |
| Ambiente | Dia e noite em 12 minutos, janelas e faróis à noite, chuva ocasional e menor aderência |
| Fauna | Cães, gaivotas, borboletas e vagalumes animados |
| Contratos | Quadro com três serviços para escolher. Cada um tem retirada, entrega e regra de carga: o sorvete derrete com o tempo, o figurino quebra em batidas e o café paga bônus por direção suave. O resultado explica o pagamento. Chuva paga 20% a mais |
| Oficina | Marcador laranja. Reparo, freios, pneus de chuva, proteção de carga, munição, granadas, outros carros e repintura durante a fuga. Melhorias têm contrapartida |
| Identificação | A polícia procura o veículo em que você foi visto. Trocar de carro, descer ou repintar sem ser visto encurta o reconhecimento e a busca |
| Salvamento | Dinheiro, entregas, melhorias, carros comprados, munição, granadas e vida |

O carro coral próximo ao personagem pode ser usado sem infração. Entre nele com E após se aproximar. Outros carros podem gerar um chamado por furto, e roubar um carro em movimento expulsa o motorista. Pedestres mortos deixam dinheiro. Ser preso mostra a tela RODOU. Atropelar, atirar, explodir, causar colisões fortes ou atingir viaturas também aumenta o alerta. A violência é estilizada em blocos, com sangue em partículas e poças.

## Controles

| Entrada | Ação |
| --- | --- |
| W A S D ou setas | Caminhar ou dirigir |
| Shift | Correr |
| E | Entrar ou sair de um carro próximo |
| Espaço | Freio de mão |
| Clique ou F | Atirar a pé. No carro, F buzina |
| G | Arremessar granada |
| Arrastar o mouse | Girar a câmera |
| 1, 2, 3 | Aceitar um serviço do quadro |
| Enter | Abrir a oficina no marcador laranja |
| R | Recarregar a pistola |
| T | Alternar chuva |
| N | Alternar dia e noite |
| H | Consultar controles |
| Esc | Pausar ou pular a abertura |

## Estrutura para edição

| Arquivo ou pasta | Uso |
| --- | --- |
| PROMPT_FABLE_5_2.md | Pedido completo para o agente |
| index.html e styles.css | Interface, menu e HUD |
| src/config.js | Parâmetros e entregas |
| src/world.js | Cidade, materiais e modelos procedurais |
| src/main.js | Controles, simulação, câmera e interface |
| src/police.js | Rotas, detecção, perseguição e fuga |
| src/audio.js | Síntese sonora local |
| assets/ | 16 PNGs, 9 GLBs, 9 WAVs, ícone, prancha e catálogo |
| vendor/ | Three.js r160 com versão fixa |
| tools/ | Geradores, validador de recursos e empacotador |
| tests/ | Verificações de lógica e integração |
| docs/ | Direção criativa, critérios de aceite e relatório de verificação |
| licenses/ | Licença dos recursos, aviso do motor e procedência |

O jogo usa geometrias, cores e sons criados no próprio código. Os PNGs, GLBs e WAVs exportados ficam prontos para expansão. Eles não são carregados todos pelo protótipo. A prancha assets/preview.png mostra os recursos exportados e não é uma captura da tela do jogo.

## Atualizar a versão única

Edite os arquivos de origem e execute com Python 3 já instalado. O comando usa somente a biblioteca padrão e não acessa a rede.

```sh
python3 tools/package.py
```

Ele recria JOGAR_OFFLINE.html com o código atual. Não edite esse HTML grande à mão nem peça ao agente para lê-lo inteiro.

## Verificar

Os testes de lógica usam Node já instalado e não exigem npm. A validação dos recursos exige Python 3 e Pillow. O gerador dos recursos também usa NumPy. Essas dependências de desenvolvimento não são necessárias para jogar.

```sh
node tests/police.test.js
node tests/integration.test.js
python3 tools/validate_assets.py
python3 tools/audit_offline.py
```

O teste de integração usa classes reais de geometria do Three.js com renderizador substituído. Ele verifica a simulação, sem abrir um navegador. Consulte docs/VERIFICACAO.md para distinguir o que foi executado do que ainda exige conferência visual.

## Limites atuais

Este é um protótipo compacto com colisões por volumes e direção arcade. Não há interiores, bloqueios de rua, ruas de sentido único, eventos de rua, troca de armas, tiro de dentro do carro, física de capotamento, multiplayer ou campanha longa. Carros são sólidos para o jogador a pé. Pedestres ainda não bloqueiam a passagem. Postes de luz e semáforos ainda não têm colisão. NPCs não têm diálogos e podem repetir trajetos. Os modelos exportados não têm esqueleto de animação.

A meta de fluidez não representa FPS medido. A imagem e o ciclo de jogo foram conferidos num navegador Chromium. Áudio reproduzido, desempenho em GPU e abertura direta por file:// ainda precisam de conferência no computador de destino. A base inclui redução automática de resolução e desativação de sombras quando a taxa observada cair.

O código próprio e o Three.js usam MIT. Os recursos originais gerados têm dedicação CC0-1.0 nos limites dos direitos aplicáveis. O nome Baía Neon é provisório e não passou por pesquisa de registro. Os avisos e textos de licença ficam no pacote.
