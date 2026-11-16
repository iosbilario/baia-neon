# Publicação e recuperação

## Princípios

`src/config.js` guarda a versão base. O lançamento recebe versão, tag e SHA completo. `tools/release.py` incorpora esses dados nos pacotes sem alterar o código aprovado, permitindo que candidata e estável usem o mesmo SHA.

O workflow nunca publica direto de `main`: ele faz checkout do SHA informado, testa esse commit, gera uma distribuição e cria explicitamente a tag nesse SHA. A release começa como rascunho, recebe cinco anexos, confere a quantidade e só então é publicada.

## Candidata

1. Faça o merge do PR aprovado.
2. Abra **Actions → Publicar release → Run workflow**.
3. Informe `0.3.0-rc.1`, o SHA completo do merge, `prerelease=true` e `deploy_pages=false`.
4. Baixe os cinco anexos, confira `SHA256SUMS.txt` e execute os critérios manuais.
5. Qualquer correção de código exige um novo SHA e `rc.2` ou posterior.

## Estável

Execute o mesmo workflow com `0.3.0`, exatamente o SHA da candidata aprovada, `prerelease=false` e `deploy_pages=true`. O job de Pages baixa o ZIP web da própria release, confere o hash e publica seu conteúdo.

## Reexecução

Se a tag ou release já existir, o workflow exige o mesmo SHA e compara todos os anexos byte a byte. Qualquer divergência interrompe a execução. Tags, releases e anexos anteriores não são substituídos.

## Recuperação do site

Abra **Actions → Recuperar versão do Pages**, informe uma versão estável anterior e execute. O workflow recusa prereleases, baixa o ZIP web daquela release, valida o SHA-256 e publica o pacote. `deployment-info.json` registra no site qual release foi recuperada.

O progresso v0.3 usa `baia-neon-save-v2`. Voltar o site à v0.2 não sobrescreve esse dado; a versão antiga continua usando `baia-neon-save`. O site e um HTML aberto por `file://` podem pertencer a áreas de armazenamento diferentes do navegador.

## Verificação local

```sh
node tests/police.test.js
node tests/integration.test.js
node tests/v03.test.js
python3 tools/package.py
python3 tools/audit_offline.py
python3 tests/release.test.py
```
