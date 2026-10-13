🇺🇸 Read in English: [README.en.md](README.en.md)

# Página do DA11Y.md

Este repositório guarda a página do [DA11Y.md](https://github.com/fecarrico/DA11Y.md). O DA11Y.md é a edição de design do [A11Y.md](https://github.com/fecarrico/A11Y.md) e leva as mesmas regras de acessibilidade para quem desenha interfaces em software de design, sejam pessoas ou agentes de IA.

**No ar:** https://fecarrico.github.io/da11ymd/

## A página segue o A11Y.md

A página foi feita com IA seguindo o A11Y.md no perfil Shield. É o perfil mais exigente do padrão, e ele pede o nível AAA da WCAG 2.2. Dois arquivos registram como isso foi feito.

- [`REPORT.md`](REPORT.md) é o relatório de verificação. Ele diz o que foi testado, o que foi medido e o que ainda falta testar.
- [`A11Y-DECISIONS.md`](A11Y-DECISIONS.md) guarda as escolhas entre soluções igualmente acessíveis, para a página seguir um padrão só.

A cada envio para a `main`, o verificador estático do A11Y.md roda antes da publicação, e se ele reprovar, a página não sai. Ele só acha o que dá para achar lendo o código. O que depende de gente testando, como leitor de tela e aparelho real, está no relatório.

## Como rodar

A página é HTML, CSS e JavaScript, sem etapa de build. Ela carrega os dados da cena com `fetch`, então precisa de um servidor local. Na raiz do repositório, rode o comando e abra http://localhost:8000 no navegador.

```sh
python3 -m http.server 8000 -d pagina
```
