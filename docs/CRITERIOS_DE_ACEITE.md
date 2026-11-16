# Critérios de aceite

Este documento define o que testar. Ele não declara que os testes já foram executados. O resultado observado pertence ao registro de verificação da entrega.

## Verificação funcional

| Cenário | Ação | Resultado esperado |
| --- | --- | --- |
| Primeira abertura offline | Desligar a conexão e abrir index.html sem visita anterior | Menu e mundo carregam sem recursos remotos ou tela vazia |
| Abertura de cinema | Abrir o jogo e assistir à sequência | Câmera percorre a cidade antes do menu e conclui sem bloquear o botão Jogar |
| Pular abertura | Pressionar Esc durante a sequência | Menu aparece e permite iniciar |
| Áudio bloqueado | Abrir sem gesto do usuário e depois interagir | A imagem funciona em silêncio e o áudio só tenta iniciar após interação |
| Personagem | Caminhar e correr em direções diferentes | Câmera acompanha e o personagem não atravessa prédios |
| Veículo | Aproximar, entrar com E, acelerar, frear, dar ré e sair | Ações funcionam e a saída não coloca o personagem dentro de um obstáculo |
| Colisão | Dirigir contra um edifício e contra um veículo | Impacto reduz velocidade e mantém o jogador na área navegável |
| Atropelamento | Atingir um pedestre em movimento e depois aproximar lentamente de outro | Contato em velocidade registra o crime e mera proximidade não registra |
| Alerta | Cometer um crime reconhecido pelo jogo | HUD informa o alerta e viaturas passam a responder |
| Navegação policial | Fugir por um quarteirão e atravessar uma ponte | Viaturas usam vias transitáveis e não cruzam prédios ou o canal |
| Linha de visão | Manter uma viatura perto, depois colocar um prédio entre ela e o jogador | A detecção distingue visão direta de obstrução |
| Busca | Romper contato visual | Polícia investiga a última posição vista e o HUD informa a busca |
| Fuga | Permanecer oculto e sair da região de busca | Alerta termina e a exploração continua |
| Contato recuperado | Ser visto antes de completar a fuga | Busca volta à perseguição e o intervalo de fuga reinicia |
| Sem fuga automática | Permanecer visível por mais tempo que o intervalo de busca | Alerta continua ativo |
| Captura | Ficar perto dos perseguidores pelo tempo exigido | Consequência aparece e o reinício deixa o jogador num ponto seguro |
| Noite | Aguardar ou usar o controle de diagnóstico existente | Luz ambiente muda e parte das janelas e luzes de rua acende |
| Chuva | Aguardar ou usar o controle de diagnóstico existente | Chuva começa, afeta som e direção, depois termina |
| Vida urbana | Observar a cidade em exploração | Pedestres, trânsito, aves, cães e insetos apresentam movimento |
| Entregas | Completar os três trajetos | Cada destino pode ser alcançado e a conclusão atualiza o objetivo |
| Foco da página | Trocar de aba durante a direção | Jogo pausa e não avança para uma captura sem controle |
| Reinício | Reiniciar após captura ou saída de área | Jogador recupera uma posição válida e pode continuar |

## Verificação do pacote

- Não há dependência de CDN, analytics, fontes remotas, login, API ou cache anterior.
- O navegador não faz requisições externas durante a abertura e a partida.
- Os arquivos citados por HTML, CSS e JavaScript estão presentes.
- A semente produz o mesmo mapa nas mesmas condições.
- Os recursos têm origem e licença registradas no catálogo.
- O aviso MIT do Three.js acompanha a cópia local do motor.
- Os geradores não são necessários para iniciar a partida.
- Erros de carregamento, áudio e WebGL aparecem de forma compreensível, sem travar silenciosamente.

## Como registrar o resultado

Use uma rodada curta com cenários combinados. Uma captura durante o dia e outra à noite bastam para a inspeção visual de rotina. Repita apenas o trecho associado a uma falha encontrada.

Registre navegador, modo de abertura, cenários executados e falhas restantes. Caso meça desempenho, informe resolução, duração da amostra e ambiente. Uma meta de FPS não equivale a desempenho medido.

Não trate leitura de código como teste de interação. Não marque um cenário como aprovado porque existe uma função com nome compatível. Se a ferramenta de execução não estiver disponível, mantenha o cenário como pendente.
