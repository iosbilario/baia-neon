# Histórico de versões

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
