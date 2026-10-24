# Você prefere? Edição terror

Jogo de dilemas no estilo "Would you rather", com clima de filme de terror. Cada tela mostra duas opções ruins de jeitos diferentes. Você escolhe, vê como a escolha ficou em porcentagem e discute com os amigos quem tomaria a decisão mais burra.

Webapp mobile-first: abre direto no navegador do celular, sem instalação.

## Como jogar

1. Leia as duas opções.
2. Toque na que você escolheria.
3. Veja a porcentagem e a justificativa na conversa.
4. Toque em **Próxima** para seguir.
5. **Voltar** desfaz só a última resposta, para corrigir um toque errado.

No computador, as setas ← e → votam, Espaço ou Enter avança e Backspace volta.

## Estrutura

```
would-you-ratherween/
├── index.html      # app: HTML, CSS e JS em um arquivo
├── questions.js    # 100 perguntas com id fixo
├── supabase.sql    # tabela votes e funções cast_vote, get_votes, undo_vote
└── README.md
```

Fase 2 (placar compartilhado) adiciona `config.js`, que ainda não existe nesta versão.

## Rodar localmente

Abrir o `index.html` direto no navegador já funciona. Para testar no celular da mesma rede Wi-Fi:

```bash
python3 -m http.server 8000
```

Depois acesse `http://IP-DO-SEU-COMPUTADOR:8000` no celular. Para descobrir o IP, use `ipconfig` (Windows) ou `ip a` / `ifconfig` (Linux e Mac). O firewall pode bloquear a porta 8000.

## Publicar no GitHub Pages

1. O repositório precisa ser público (no plano gratuito, o Pages só funciona assim).
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O site fica em `https://SEU-USUARIO.github.io/would-you-ratherween/` após alguns minutos.

## Regras das perguntas

Essas regras valem para quem for escrever ou editar o `questions.js`.

**Id fixo.** Cada pergunta tem um `id` no formato `q001`, `q002` etc. O id é a chave dos votos salvos.
- Trocar o texto de `a` ou `b` mantém os votos.
- Se o sentido mudar muito, crie uma pergunta nova com id novo (ex.: `q101`) e tire a antiga da lista.
- Nunca reutilize um id para outra pergunta.
- A ordem do array não importa.

**Critério de escrita.**
- Duas opções igualmente ruins, de jeitos diferentes. Não existe resposta certa.
- Cada opção cabe em uma frase curta.
- Evite perguntas de resposta óbvia. Se quase todo mundo escolheria o mesmo lado, a pergunta não gera debate.
- Evite vítima obrigatória (criança, irmão, animal) como gatilho da escolha. Se aparecer, que seja raro.
- Prefira custos sociais, morais ou pessoais (passar vergonha, mentir, perder credibilidade, abrir mão de algo) a perder vidas.

**Mistura de tons.** Aproximadamente 60% equilibradas, 25% absurdas e 15% de tensão (escolhas ruins de um jeito e pior do outro).

## Limitações conhecidas (fase 1)

- Os votos são só do navegador de cada pessoa. As porcentagens usam uma base de exemplo para não começarem em 50/50. A fase 2 (Supabase) resolve isso.
- Limpar os dados do navegador apaga o progresso e os votos.
- O botão Voltar desfaz só a última resposta. Recarregar a página não preserva essa possibilidade.
- Quem usa vários aparelhos tem progresso separado em cada um.

## Próximas fases

**Fase 2: placar compartilhado.** Criar um projeto no [Supabase](https://supabase.com), rodar o `supabase.sql` no SQL Editor, copiar a Project URL e a chave `anon public` (em Project Settings → API) para um `config.js`. Com isso, as porcentagens passam a somar os votos de todo mundo. O Voltar desfaz também no placar compartilhado.

Projetos gratuitos do Supabase são pausados após uma semana sem uso. Basta reativar no painel antes de uma rodada.

## Testes em aparelhos reais

Antes de compartilhar o link, teste em:
- Safari no iPhone (área segura e altura da tela)
- Chrome no Android
- Um desktop, para os atalhos de teclado