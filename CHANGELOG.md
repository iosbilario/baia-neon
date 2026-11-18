# Histórico de versões

## [1.0.0] — Cidade Completa

### Para quem joga

- Controle: Gamepad API com zona morta radial, vibração opcional e dicas de tela por dispositivo.
- Ruas de sentido único com setas no asfalto; trânsito e GPS seguem a mão.
- Postes e semáforos quebráveis, contato suave com pedestres e bloqueios policiais.
- Três armas (pistola, submetralhadora, espingarda), tiro de dentro do carro, dano por zona e capotamento arcade.
- Quatro interiores a pé: Rádio Caju, Oficina do Canal, Mercado Maré Alta e Píer Farol, com atividades internas e três capítulos novos.
- Qualidade gradual em três níveis, mantendo o recuo por FPS baixo.

### Saves

Schema 2 preservado. Campos novos (arsenal, interiores, campanha ampliada) são aditivos; saves anteriores continuam válidos.

## [0.6.2] — Pé no Chão

### Correções

- A altura física do parque elevado agora usa a mesma curva da geometria 3D.
- O personagem permanece inteiro sobre a superfície enquanto sobe a ladeira.
- A câmera acompanha a elevação e não atravessa o terreno.
- Pedestres, caminhos e efeitos usam a mesma referência vertical do parque.

## [0.6.1] — Costa Firme

### Correções

- Terra e areia agora têm as faces 3D orientadas para cima e permanecem visíveis sobre o oceano.
- A faixa contínua de areia foi substituída por sete trechos definidos de praia.
- Guarda-sóis são posicionados e validados pelo polígono real da costa.
- Palmeiras, bancos, placa, abrigos e vasos costeiros mantêm distância do mar e das ruas.
- Quiosques que atravessavam a água foram removidos.

## [0.6.0] — Ilha no Horizonte

### Para quem joga

- Mapa redesenhado como Ilha Ferradura, com costa irregular e limite jogável orgânico.
- Avenida de orla acompanha a maior parte da costa; ruas terminam em praças, mirantes, marina e construções.
- Grade viária, tráfego, polícia e rotas permanecem sobre terra firme.
- Horizonte cenográfico com ilha distante, farol, cargueiro, boias e tempestade animada.
- Destinos escolhidos sobre o mar retornam ao ponto seguro mais próximo da ilha.
- Píer Farol reposicionado dentro da nova baía.
- Bicicletas ganharam quadro completo, selim, guidão, pedais, rodas animadas e ciclista sentado.
- Ciclistas e visitantes dos parques agora conversam por ação contextual e reagem a atropelamentos.
- Save da v0.5.0 continua compatível no schema 2.

## [0.5.0] — Na Mão

### Para quem joga

- Controle de PC inspirado no padrão de jogos de mundo aberto: câmera pelo mouse com pointer lock, mira central e visão sobre o ombro.
- Clique esquerdo atira, botão direito segura a mira e `Esc` libera o ponteiro e pausa.
- Câmera de direção retorna suavemente para trás do veículo.
- Controles móveis em paisagem com analógico, área de câmera, ações contextuais, aceleração, freio e freio de mão.
- HUD reorganizado no celular para separar mapa, objetivo, status e botões.
- Orientação em retrato mostra instrução para girar o aparelho.
- Save da v0.4.0 permanece compatível no schema 2.

## [0.4.0] — Cidade Viva

### Para quem joga

- Cidade reconstruída com 249 prédios, 12 arranha-céus de até 125 metros, lotes sem sobreposição e skyline por bairros.
- Personagens articulados e carros com volumes arredondados, rodas e iluminação mais detalhadas.
- Mira acompanha o ponteiro e calcula o disparo por raycast no mundo 3D; botão direito gira a câmera.
- Parques com árvores, grama, aves, cães, pessoas brincando e lendo.
- Ciclistas, trabalhadores, fumantes, pessoas descansando, lixo urbano e aviões.
- Ocorrências autônomas com resposta visual de uma viatura, sem atribuir o crime ao jogador.
- Canteiro de obras, túnel dirigível e parque elevado com ladeira para pedestres.
- Companhia adulta opcional e não explícita, com pagamento único e encontro implícito em local reservado.

### Compatibilidade

- O schema de save continua na versão 2 e preserva o progresso da v0.3.0.
- Todo o conteúdo continua local e disponível no pacote offline.

## [0.3.0] — Última Frequência

### Para quem joga

- Campanha curta de cinco missões sobre a mudança da Rádio Caju, com checkpoints, falha, repetição e desfecho persistente.
- Mapa ampliado em `M`, destino selecionável e rota pelas ruas e pontes.
- Contratos repetíveis de entrega, passageiros e recuperação de veículos.
- Três percursos contra o relógio, medalhas e recorde local por veículo.
- Reputação, modo foto, controle do movimento de câmera e progresso exportável.
- Centro Solar, Canal das Garças e Praia Aurora receberam fachadas, mobiliário, marcos, iluminação e chuva mais variados.

### Compatibilidade e distribuição

- Saves v0.2 são copiados, migrados para o schema 2 e mantidos separados para permitir retorno à versão anterior.
- Site e pacote offline usam a mesma identificação de versão, tag e SHA.
- Releases reproduzíveis incluem distribuição web, HTML autocontido, ZIP offline, metadados e hashes SHA-256.
- O Pages passa a publicar a distribuição web anexada à release estável.

## [0.2.0] — Protótipo jogável

- Cidade 3D compacta com caminhada, três veículos, três entregas, oficina, progressão local, polícia, testemunhas, chuva e ciclo de dia e noite.
- Abertura cinematográfica e HTML autocontido para jogar offline.
- Limitações: sem campanha, mapa ampliado, rotas, corridas, migração versionada ou fluxo formal de releases.
