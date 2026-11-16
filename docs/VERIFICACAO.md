# Verificação da entrega

Executada em 16 de novembro de 2026. Este relatório separa testes de código de inspeção no navegador.

## Testes de código

| Verificação | Resultado |
| --- | --- |
| Lógica policial | 14 cenários aprovados em tests/police.test.js |
| Integração da simulação | 15 cenários aprovados em tests/integration.test.js, com renderizador substituído |
| Dependências offline | Auditoria estática aprovada para index.html e JOGAR_OFFLINE.html |
| Versão única | Recriada com tools/package.py depois das alterações |
| Integridade dos recursos | Não repetida nesta rodada. O validador exige Pillow, ausente neste computador. Os recursos não foram alterados |

## Rodada no navegador

Navegador embutido do aplicativo Claude (Chromium), com WebGL, servindo a pasta por HTTP em localhost. Os cenários foram conduzidos pelos auxiliares de `?test=1`, que avançam a simulação real em passos de 1/60 s e simulam teclas. A janela de automação perde o foco a cada comando, então a condução por teclado físico não foi usada.

| Cenário | Resultado observado |
| --- | --- |
| Abertura, Esc e menu | Sequência chega ao menu em 18 s, Esc pula, Rever abertura funciona, botão Jogar inicia |
| Personagem | Caminha e corre, câmera acompanha, posição nunca fica dentro de colisor |
| Veículo | Entrada com E a curta distância, aceleração até 32 m/s, freio, ré, curva e saída em ponto livre |
| Colisão | Prédio e carro parado reduzem e invertem a velocidade. Borda do mapa e canal fora da ponte bloqueiam. A ponte permite a travessia |
| Atropelamento | Contato acima de 4 m/s registra o crime uma vez por alvo. Contato lento, carro parado ao lado e buzina não registram |
| Alerta e reforços | HUD mostra o nível, reforços surgem a mais de 110 m e sem linha de visão |
| Navegação policial | Nenhuma viatura ocupou posição bloqueada em cerca de 6 minutos simulados, amostrados a cada passo |
| Perseguição, busca e fuga | Perseguição até a última posição vista, busca na região, fuga após 22 s fora da área, com HUD distinto em cada fase |
| Contato recuperado | Ser visto durante a busca volta à perseguição e zera o progresso de fuga |
| Sem fuga automática e captura | Parado e visível, o alerta se mantém e a captura ocorre após 3,2 s de contato, com multa e reinício no ponto seguro |
| Entregas | Os três destinos concluem, pagam e o ciclo recomeça |
| Noite e chuva | Janelas acesas, céu e neblina escuros, partículas de chuva. Na chuva o carro acelera, freia e vira menos |
| Vida urbana | 14 carros de trânsito e 36 pedestres em movimento sem entrar em colisores. 110 objetos de fauna e cenário animados |
| Foco da página | Perder o foco pausa a partida, confirmado a cada comando da automação |
| Rede e console | Somente arquivos de localhost. A CSP bloqueou uma tentativa de fetch. Nenhum erro no console |
| JOGAR_OFFLINE.html | Carrega sem arquivos externos e repete colisão, limites e ponte |

Inspeção visual de rotina com duas capturas, uma de dia durante perseguição e outra à noite com chuva. Ambas legíveis, com pista, calçada, áreas verdes e HUD distinguíveis.

## Correções desta rodada

- Viaturas seguem até a última posição vista antes de iniciar a busca. Antes, a busca começava 2,5 s depois do chamado.
- Viaturas com visão direta se aproximam a partir de 45 m, formam fila e não se empilham. Se o caminho direto falhar, voltam à rota por ruas.
- Reforços surgem atrás de prédios e nunca sobre outra viatura.
- A chuva reduz também aceleração e frenagem.
- Intervalo de quadro negativo no primeiro quadro foi limitado a zero. O botão do menu passou a se chamar Jogar.

## Segunda rodada: combate, dano e cidade viva

Mesmo navegador e mesmo método. Resultados observados:

| Cenário | Resultado observado |
| --- | --- |
| População | 46 carros, sendo 32 parados, e 64 pedestres, nenhum dentro de colisor. Após 30 s havia pedestres conversando, esperando e carros parados no semáforo |
| Tiro em pedestre | Primeiro tiro fere e gera Agressão armada, o segundo mata e gera Homicídio. Pedestres próximos fogem |
| Granada | Carro estacionado destruído, com Explosão e alerta nível 4 |
| Carro baleado | Pega fogo após 6 tiros e explode sozinho cerca de 4 s depois |
| Motorista e jogador | Com o jogador 8,5 m à frente o carro freia e para a 4 m. Entrando a 3 m o jogador é atropelado e perde 32 de vida |
| Polícia atirando | No nível 5, correndo, o jogador morreu em 18,5 s por tiros da polícia |
| Morte | Câmera lenta, imagem em cinza, letreiro SE FUDEU com a causa e retorno ao ponto inicial com vida cheia |

Captura adicional da tela de morte e da explosão para conferir a legibilidade.

## Terceira rodada: testemunhas e policiais a pé

| Cenário | Resultado observado |
| --- | --- |
| Crime sem testemunha | Aviso Ninguém viu e alerta em zero |
| Testemunha | HUD mostra TESTEMUNHA AO TELEFONE e a polícia é acionada 4 s depois |
| Testemunha silenciada | Morta antes do fim da ligação, a denúncia cai e o alerta segue em zero após 8 s |
| Policial desce | A viatura chega em 6,5 s e o policial desce a 16 m do suspeito |
| Prisão a pé | Andando, o jogador é alcançado e preso em 9,5 s, com a tela RODOU e retorno ao ponto inicial sem granadas |
| Fuga correndo | Correndo por 6 s o policial não consegue prender |
| Resposta armada | No nível 3 o policial para a 11 m e atira. Dois tiros o derrubam, a viatura vazia vira carro dirigível e o alerta sobe para 5 |

Os testes de integração de furto e atropelamento passaram a conferir o registro do crime, já que o alerta depende de testemunha.

## Quarta rodada: nível de procurado

| Cenário | Resultado observado |
| --- | --- |
| Escada de estrelas | Dez crimes leves seguidos deram 1, 2, 2, 3, 3, 3, 4, 4, 4, 5 estrelas |
| Uma estrela | Duas viaturas no mapa, só uma responde. Primeiro contato 22 s após o chamado |
| Carro contra viatura | Saindo 25 m à frente, a distância foi de 29 m a 84 m em 5 s. Viatura a 16,5 m/s com uma estrela |
| Fuga | Fora de vista e longe, o alerta de uma estrela acabou em 23 s |
| Três estrelas | Viaturas passaram de 2 para 3 após 5 s, sem surgirem todas de uma vez. Parado no lugar, o jogador morreu baleado em cerca de 30 s |

Valores anteriores deste relatório que citam 22 s de busca, 55 m e tiros a partir de três estrelas refletem as regras antigas.

## Quinta rodada: carros sólidos

A pé, andando contra a lateral e correndo contra a frente de um carro, o jogador para na lataria. Colocado dentro de um carro, é empurrado para fora. Entrar e sair continuam funcionando. Dirigindo devagar contra um carro parado, o veículo para a 2,5 m do centro do outro, sem atravessar.

## Sexta rodada: direção, contratos, oficina e identificação

Correções com teste automático novo: reforços não são mais adiados por denúncias repetidas, o policial a pé não prende através de parede, na busca ele só reage dentro do cone, e roubar um carro em movimento expulsa o motorista. Derrota limpa ligações pendentes, granadas no ar, policiais a pé e o contrato em curso.

| Cenário no navegador | Resultado observado |
| --- | --- |
| Curva de 1,2 s a 22 m/s | Compacto gira 83° com 3,2 m/s de derrapagem, sedã 61° com 1,9, esportivo 75° com 4,5. Esportivo na chuva chega a 7,5 e perde velocidade |
| Freio de mão | Compacto gira 134° com 11,7 m/s de lado |
| Frenagem de 26 m/s | Compacto para em 11,6 m. Com freios reforçados, 9,2 m |
| Sorvete | Limite de 76 s. Entregue após 30 s pagou R$ 184, com o resultado explicado em garantido e qualidade |
| Identificação | Visto no carro, o HUD mostra SEU CARRO FOI IDENTIFICADO. Descendo sem ser visto, a busca terminou em 13 s |
| Oficina | Abre com Enter no marcador e lista reparo de R$ 58 para 45% de dano, melhorias e carros |

O painel da oficina e o quadro de serviços foram conferidos por captura, o primeiro na versão única. A sensação de condução depende de sessão manual.

## Sétima rodada: mapa e rotas

| Cenário | Resultado observado |
| --- | --- |
| Geração | 3 vielas, 9 estacionamentos, 5 parques e 73 carros, nenhum carro ou pedestre dentro de colisor |
| Viela | O compacto atravessa de rua a rua. O sedã para na entrada. A viatura com visão direta não entra e ficou a 18 m |
| Parque | O carro para na linha dos balizadores. A pé, o jogador entra |
| Teste automático | Vielas livres para o compacto e para pessoas em todo o comprimento, bloqueadas para sedã, esportivo e viatura. Fonte sólida. Pontos de contrato, oficina e início livres |

Captura da entrada de uma viela conferida, com os marcos amarelos e o traço no minimapa.

## Pendente

- Abertura direta por file:// e sessão com a rede fisicamente desligada.
- Áudio reproduzido. O botão de som existe e só atua após clique, mas ninguém ouviu o resultado.
- FPS. Não houve medição válida, pois a simulação foi avançada por passos de teste.
- Firefox, Edge e Safari.
- Partida completa com teclado e mouse por uma pessoa.
