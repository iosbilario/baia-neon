# Verificação da v0.3.0-rc.1

Executada em 16 de novembro de 2026 no macOS Apple Silicon. O código aprovado ainda precisa de teste humano completo antes da promoção para estável.

## Automatizado

| Verificação | Resultado |
| --- | --- |
| Polícia | 14 cenários aprovados em `tests/police.test.js` |
| Integração | 16 cenários aprovados em `tests/integration.test.js` |
| v0.3 | 7 cenários aprovados em `tests/v03.test.js`: migração e backup, isolamento do save v2, importação, checkpoints, falha, pagamento único, prazo e rotas viárias |
| Release | `tests/release.test.py` aprovou nomes, metadados, hashes, conteúdo e ZIPs reproduzíveis |
| Offline | `tools/audit_offline.py` aprovou recursos locais, CSP, ausência de APIs de rede e HTML autocontido |
| Workflows | Os três YAMLs foram carregados pelo parser do Ruby; scripts Python passaram por `py_compile` |

## Navegador real

Chrome headless, viewport 1280 × 800, WebGL por SwiftShader e abertura direta por `file://`.

- `index.html` renderizou a Praia Aurora durante o dia e o Píer Farol à noite sob chuva.
- `JOGAR_OFFLINE.html` abriu diretamente sem servidor e renderizou a mesma cena noturna.
- O harness integrado concluiu as cinco missões, registrou cinco recompensas únicas, falhou e repetiu uma missão, concluiu um contrarrelógio, criou uma rota com nove segmentos, comprou os freios, salvou e releu o progresso no schema 2.
- Resultado do harness: campanha `finished`, 5 missões, 5 recompensas, 1 repetição, saldo R$ 1.960, reputação 29, 1 recorde e save restaurado como `finished`.
- As capturas finais estão em `assets/release/v030-day.png` e `assets/release/v030-night-rain.png`; a comparação usa `assets/release/v020-day.png` e `assets/release/v020-night-rain.png`, capturadas do SHA da v0.2.0 no mesmo Chrome e resolução.

Na comparação, a v0.2 mostra quarteirões de fachadas lisas e repetidas. A v0.3 acrescenta marquises, sacadas, entradas, mobiliário, padrões de janela, o Mercado Maré Alta e o Píer Farol como silhuetas reconhecíveis. A cena noturna preserva a leitura da rua e deixa chuva, janelas emissivas e o letreiro do píer visíveis.

## Balanceamento

A rota viária mínima pelos 12 objetivos da campanha mede 4.778 m. A 4 m/s de velocidade média efetiva, sem contar embarque, diálogos, mapa, reparos, polícia e exploração, ela ocupa 19,9 minutos. Isso sustenta a meta de 20 a 30 minutos, mas não substitui a cronometragem humana.

A retirada regular da segunda missão custa R$ 120; a primeira missão paga até R$ 320. Uma melhoria útil custa R$ 300 e fica acessível dentro do começo esperado da campanha. O resgate comunitário devolve gratuitamente o carro inicial quando o jogador fica sem dinheiro ou perde o veículo.

## Bloqueios para v0.3.0 estável

- Partida completa de 20 a 30 minutos conduzida por uma pessoa com teclado e mouse.
- Cronometragem real da campanha e medição de FPS no mesmo equipamento antes e depois.
- Audição dos efeitos, chuva e vinhetas em hardware real.
- Exercício manual de mapa, modo foto, importação de arquivo, perseguição, prisão e morte no fluxo completo.
- Firefox, Safari e Edge continuam sem rodada manual.

Enquanto esses itens não forem executados, a entrega permanece candidata. Nenhum número de FPS foi inferido do Chrome headless.
