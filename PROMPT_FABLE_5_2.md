# Baía Neon

## Missão

Você é o agente responsável por concluir e polir o jogo 3D deste diretório. Execute o trabalho nos arquivos. Entregue uma versão jogável offline, com controles claros, objetivos curtos e perseguição policial que possa ser vencida. O kit já contém uma base de jogo, motor local, fontes e recursos originais. Inspecione o que existe e implemente somente o que faltar ou falhar.

A referência é o gênero de ação urbana em mundo aberto, com liberdade para caminhar e dirigir numa cidade litorânea. Baía Neon tem identidade própria. Trabalhe com um protótipo compacto e estilizado, sem prometer escala, realismo ou conteúdo de uma produção AAA.

## Economia de tempo e tokens

1. Comece por README.md, src/config.js e index.html. Leia docs/VERIFICACAO.md para não repetir verificações já feitas e docs/CRITERIOS_DE_ACEITE.md para saber quando encerrar. Consulte somente os trechos de src/main.js e src/world.js relacionados ao trabalho escolhido.
2. Antes de editar, dê um plano de até cinco linhas. Em seguida, implemente. Não peça aprovação para decisões reversíveis previstas neste prompt.
3. Reutilize o motor, a arquitetura, as geometrias, os materiais e a lógica presentes. Não troque a stack. Não instale pacotes, gere um framework, abra uma busca na internet ou crie uma equipe de agentes.
4. Não leia vendor/three.min.js, JOGAR_OFFLINE.html, arquivos binários, diretórios inteiros ou todo o catálogo de recursos. Use assets/manifest.json para localizar um recurso apenas quando precisar dele. Não despeje arquivos completos no chat.
5. Faça uma passagem de implementação e uma rodada curta de verificação. Corrija falhas observadas. Limite a inspeção visual de rotina a duas capturas, uma durante o dia e outra à noite. Faça verificações adicionais somente para resolver uma falha concreta.
6. Prefira funções pequenas e ajustes locais. Evite refatoração estética, múltiplas alternativas, debates de arquitetura, arquivos duplicados e documentação que repita este prompt.
7. Ao atingir os critérios funcionais, pare. Registre o resultado, os controles, os testes executados e as limitações reais em até 20 linhas. Se a sessão for interrompida, deixe um checkpoint curto com arquivos alterados e próxima ação.

Estas regras reduzem trabalho repetido. Elas não representam uma garantia de custo ou uma contagem exata de tokens. Não sacrifique um requisito obrigatório para encerrar uma rodada de testes.

## Execução offline

Mantenha HTML, CSS e JavaScript clássico com o Three.js local. Preserve o caminho de abertura direta de index.html e a versão única JOGAR_OFFLINE.html. Depois de editar os fontes, recrie a versão única com python3 tools/package.py. O empacotador usa somente a biblioteca padrão. Um servidor HTTP local pode ser usado durante o desenvolvimento, desde que o navegador não precise de acesso externo.

O jogo deve iniciar e continuar com a conexão desligada. Não use CDN, telemetria, APIs, mapas remotos, fontes remotas, login, áudio transmitido, vídeos externos ou downloads no primeiro acesso. Não dependa de cache de uma visita anterior. Os arquivos necessários já devem estar no pacote.

Use as geometrias e texturas procedurais atuais quando elas forem suficientes. Os PNGs, WAVs e GLBs de assets/ são recursos locais para reutilização. O jogo e os GLBs usam metros, Y para cima e frente em +Z. Não adicione um carregador só para consumir um GLB se a geometria equivalente já existir no código. Preserve os geradores para que o conteúdo possa ser refeito.

Ative o áudio somente depois de uma ação do usuário. O jogo deve funcionar quando o áudio estiver bloqueado ou silenciado. Pause a simulação quando a página perder o foco para evitar deslocamentos, colisões e capturas sem controle do jogador.

## Direção visual e cidade

Crie uma miniatura imaginária do litoral do sul da Flórida. O mapa representa Baía Neon e não reproduz o mapa de um jogo existente. Use cerca de 600 por 600 metros, prédios art déco em tons claros, uma pequena área de torres, praia, canal, pontes, praças e ruas com palmeiras.

Preserve a malha prevista pelo kit. As ruas ficam nas coordenadas −240, −160, −80, 0, 80, 160 e 240 dos eixos horizontais. O canal ocupa o intervalo de x entre 106 e 132. As travessias acompanham as ruas horizontais, com corredores de ponte de cerca de 18 metros. A praia e o oceano ficam a leste.

A cidade precisa permitir circulação. Colisores devem acompanhar os volumes visíveis. Evite postes no centro da pista, carros presos no ponto inicial, prédios que bloqueiem todas as saídas e água atravessável fora das pontes. Inclua limites claros ou reposicionamento seguro quando o jogador sair da área utilizável.

Use materiais leves, sombras seletivas e geometria de poucos polígonos com boa silhueta. O jogador deve distinguir calçada, pista, praia, água e áreas verdes sem ler uma legenda. Placas e estabelecimentos usam nomes fictícios. Não adicione marcas reais.

## Abertura antes do jogo

Antes de liberar o controle, apresente uma sequência cinematográfica de aproximadamente 15 a 20 segundos renderizada pelo próprio motor. Mostre a orla, atravesse a cidade, revele o protagonista e termine na composição do menu com o título Baía Neon e o botão Jogar.

Use movimento suave de câmera, barras de cinema, transições curtas, luz de fim de tarde e um tema original do kit. O som aguarda interação. A abertura pode começar em silêncio e oferecer um botão para ativá-lo. Esc deve pular a sequência e chegar ao menu.

O botão Jogar inicia a simulação com o personagem em local seguro e a câmera pronta. Inclua no menu uma opção de rever a abertura. Nunca deixe a cinemática bloquear permanentemente o acesso ao jogo.

## Jogabilidade obrigatória

O personagem caminha, corre e aparece em terceira pessoa. A câmera acompanha o movimento com suavidade e permite perceber os obstáculos próximos. Os controles ficam visíveis no menu e podem ser consultados durante o jogo.

O jogador entra e sai de carros próximos com E. A entrada não pode ocorrer a distância. A saída deve procurar uma posição livre ao lado do veículo. Os carros aceleram, freiam, dão ré e fazem curvas. Inclua resposta de motor, colisão com prédios e perda de velocidade em impactos. A chuva reduz a aderência de forma perceptível, sem tornar a direção impossível.

NPCs caminham pelas calçadas e reagem a perigo próximo. Carros de trânsito seguem a malha viária. Use estados e percursos simples, com limites de quantidade. Um atropelamento exige contato com o pedestre e velocidade compatível. Aproximação, buzina ou um carro parado ao lado dele não devem contar como atropelamento.

Inclua cães em áreas verdes, aves na orla e insetos próximos à vegetação. Use animações curtas e comportamento leve. Eles não precisam simular um ecossistema. Não aplique física cara a cada inseto.

Ofereça pelo menos três trajetos curtos de entrega, com destino visível, progresso, conclusão e possibilidade de repetir. A exploração livre continua disponível. O HUD mostra objetivo, velocidade quando estiver num carro, horário, nível de alerta e minimapa.

## Crimes e polícia

Implemente crimes concretos no mundo do jogo, como tomar um veículo ocupado, atropelar um pedestre e atingir uma viatura. O evento deve ter consequência visível e aumentar um nível de alerta limitado. Use uma pequena espera por alvo para evitar dezenas de registros pelo mesmo contato.

As viaturas patrulham, recebem o chamado, perseguem e procuram o jogador. Elas devem navegar por ruas e pontes, respeitar colisores e chegar ao local por um trajeto plausível. Não atravesse prédios, água ou barreiras para encurtar o caminho.

A detecção considera distância e linha de visão bloqueada por edifícios. Quando perderem contato, as viaturas seguem até a última posição vista e passam a procurar na região. Mostre a diferença entre perseguição e busca no HUD.

O jogador despista ao sair da visão das viaturas por um intervalo contínuo e se afastar da área de busca. A visão recuperada reinicia esse intervalo. O alerta não desaparece enquanto houver uma viatura vendo o jogador. Use quantidade máxima de perseguidores e surgimento fora da câmera, sem materialização ao lado do personagem.

A captura exige aproximação e tempo de contato, com tolerância a um esbarrão. Mostre a consequência e ofereça reinício em local seguro. O ciclo de cometer um crime, receber perseguição, quebrar contato e voltar à exploração precisa funcionar do começo ao fim.

## Ambiente vivo

Implemente ciclo de dia e noite com transição gradual de luz, céu e neblina. À noite, parte das janelas acende com padrão estável, junto das luzes de rua e dos veículos. Não use uma luz dinâmica para cada janela.

A chuva aparece ocasionalmente, dura um período limitado e termina. Ajuste partículas, som, aparência da pista e aderência de acordo com a intensidade. Reutilize partículas em torno da câmera. Evite criar e destruir milhares de objetos a cada quadro.

Use uma semente fixa para reproduzir o mapa e facilitar correções. Separe geração inicial de atualização por quadro. Reaproveite geometrias e materiais, agrupe elementos repetidos e limite a população distante. Busque fluidez em um notebook comum, com resolução ajustável. Só informe FPS quando houver uma medição identificável.

## Autoria e entrega

Preserve as licenças presentes e a origem declarada de cada recurso. O código próprio usa MIT e os recursos originais do kit são destinados a CC0 conforme os arquivos de licença. Mantenha o aviso de terceiros do Three.js.

Não use personagens, mapas, logotipos, músicas, vozes, carros identificáveis ou elementos visuais copiados de GTA. A sátira trata de uma cidade fictícia e de situações urbanas absurdas. Chamar algo de paródia não resolve sozinho questões de direitos. O nome de trabalho ainda não passou por pesquisa de marca.

Entregue os arquivos locais, instruções de abertura e o registro curto da verificação. Não publique o projeto. Se não houver navegador ou outra ferramenta para um teste, informe o teste pendente sem inventar resultado.
