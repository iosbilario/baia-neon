# Verificação da v0.4.0-rc.1

## Automatizado

- 14 testes da lógica policial.
- 20 testes de integração da simulação.
- 7 testes de saves, campanha, pagamento único e rotas.
- Auditoria offline e CSP aprovadas.
- Pacotes de release reproduzíveis aprovados.

Os testes de integração conferem 249 prédios, 12 arranha-céus, lotes sem sobreposição, oficina fora das ruas, cruzamentos livres nas extremidades do túnel, árvores fora da malha viária, mira divergente conforme a posição do ponteiro, ciclistas, trabalhadores, atividades nos parques, aviões, ocorrência autônoma e pagamento único do encontro adulto implícito.

## Navegador real

Chrome headless em macOS Apple Silicon, com WebGL e abertura direta por `file://`.

Foram inspecionados skyline aéreo, corredor na altura da rua, noite, personagem, carros, parque, canteiro de obras, parque elevado, túnel e Oficina do Canal corrigida.

## Validação manual pendente da candidata

- Dirigir pela malha inteira e confirmar que nenhum objeto bloqueia vias ou destinos.
- Testar a mira com mouse real, incluindo alvos próximos e distantes.
- Conferir entrada e saída dos três modelos de carro.
- Observar ciclistas, trabalhadores, parque, aviões e ocorrência autônoma durante uma sessão normal.
- Entrar e sair do túnel pelas duas extremidades.
- Caminhar até o topo do parque elevado.
- Reabrir o save real da v0.3.0.
- Confirmar desempenho e áudio em hardware real.

A prerelease não deve substituir o site estável antes dessa rodada.
