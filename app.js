(function () {
  "use strict";

  const Q = window.QUESTIONS;
  const KEY = "wyr-terror-v1";
  const CFG = window.WYR_CONFIG || {};
  const REMOTE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  /*
   * Estatísticas.
   * Modo compartilhado (config.js preenchido): os números vêm do Supabase.
   *   Se a rede falhar, mostra só os votos reais deste aparelho, com "(offline)".
   * Modo local (config.js vazio): votos só neste navegador. As porcentagens usam
   *   uma base de exemplo para não começarem em 50/50; a contagem mostra só votos reais.
   */
  const Stats = {
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY)) || {};
        return {
          votes: s.votes || {},
          seen: s.seen || [],
          voted: s.voted || {}
        };
      } catch (e) {
        return { votes: {}, seen: [], voted: {} };
      }
    },

    save(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) { /* armazenamento indisponível: o jogo segue sem salvar */ }
    },

    // Base de exemplo determinística por id (só modo local).
    seed(id) {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      const x = Math.sin(h) * 10000;
      const p = 0.3 + (x - Math.floor(x)) * 0.4; // 30% a 70%
      return { a: Math.round(p * 120), b: Math.round((1 - p) * 120) };
    },

    localVotes(id) {
      return this.load().votes[id] || { a: 0, b: 0 };
    },

    async rpc(fn, body) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      try {
        const r = await fetch(CFG.SUPABASE_URL + "/rest/v1/rpc/" + fn, {
          method: "POST",
          signal: ctl.signal,
          headers: {
            "Content-Type": "application/json",
            apikey: CFG.SUPABASE_ANON_KEY,
            Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY
          },
          body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const rows = await r.json();
        const row = Array.isArray(rows) ? rows[0] : rows;
        return { a: row ? row.out_a : 0, b: row ? row.out_b : 0 };
      } finally {
        clearTimeout(timer);
      }
    },

    /*
     * Registra o voto e devolve { pa, pb, a, b, offline, counted }.
     * pa/pb: números usados no cálculo da porcentagem.
     * a/b: votos mostrados na tela.
     * counted: false se a pessoa já tinha votado nesta pergunta (replay).
     */
    async vote(id, side) {
      const s = this.load();
      const already = s.voted[id];
      if (!s.seen.includes(id)) s.seen.push(id);
      if (!already) {
        s.voted[id] = side;
        s.votes[id] = s.votes[id] || { a: 0, b: 0 };
        s.votes[id][side]++;
      }
      this.save(s);

      const counted = !already;
      const real = this.localVotes(id);

      if (!REMOTE) {
        const base = this.seed(id);
        return {
          pa: base.a + real.a,
          pb: base.b + real.b,
          a: real.a,
          b: real.b,
          offline: false,
          counted
        };
      }

      try {
        const c = already
          ? await this.rpc("get_votes", { q: id })
          : await this.rpc("cast_vote", { q: id, side: side });
        return { pa: c.a, pb: c.b, a: c.a, b: c.b, offline: false, counted };
      } catch (e) {
        return { pa: real.a, pb: real.b, a: real.a, b: real.b, offline: true, counted };
      }
    },

    // Desfaz um voto. Se ele não tinha sido contado, só libera a pergunta.
    async undo(id, side, counted) {
      const s = this.load();
      s.seen = s.seen.filter((x) => x !== id);
      if (counted) {
        if (s.votes[id] && s.votes[id][side] > 0) s.votes[id][side]--;
        delete s.voted[id];
      }
      this.save(s);

      if (counted && REMOTE) {
        try {
          await this.rpc("undo_vote", { q: id, side: side });
        } catch (e) { /* melhor esforço: falha de rede é ignorada */ }
      }
    }
  };

  /* ---------- Interface ---------- */

  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const optA = $("optA");
  const optB = $("optB");

  let order = [];
  let pos = 0;
  let answered = false;
  let busy = false;
  let lastVote = null;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildOrder() {
    const seen = new Set(Stats.load().seen);
    order = shuffle(Q.filter((q) => !seen.has(q.id)));
    pos = 0;
  }

  function updateCounter() {
    const n = Stats.load().seen.length;
    $("counter").textContent = n + " / " + Q.length;
    $("progress").style.width = (n / Q.length) * 100 + "%";
  }

  function render() {
    app.classList.toggle("has-last", !!lastVote);

    if (pos >= order.length) {
      $("end").classList.add("show");
      return;
    }

    const q = order[pos];
    answered = false;
    app.classList.remove("revealed");
    [optA, optB].forEach((o) => {
      o.classList.remove("picked", "lost");
      o.style.removeProperty("--h");
    });
    optA.querySelector(".txt").textContent = q.a;
    optB.querySelector(".txt").textContent = q.b;
    updateCounter();
  }

  function setResult(el, pct, n, offline) {
    el.querySelector(".pct").textContent = pct + "%";
    el.querySelector(".sub").textContent =
      n + (n === 1 ? " voto" : " votos") + (offline ? " (offline)" : "");
    el.style.setProperty("--h", pct + "%");
  }

  async function choose(side) {
    if (answered || busy || pos >= order.length) return;
    answered = true;
    busy = true;

    const q = order[pos];
    (side === "a" ? optA : optB).classList.add("picked");
    (side === "a" ? optB : optA).classList.add("lost");

    const r = await Stats.vote(q.id, side);
    busy = false;
    lastVote = { id: q.id, side: side, counted: r.counted };

    const total = r.pa + r.pb || 1;
    const pa = Math.round((r.pa / total) * 100);
    const pb = 100 - pa;
    setResult(optA, pa, r.a, r.offline);
    setResult(optB, pb, r.b, r.offline);

    app.classList.add("revealed", "has-last");
    updateCounter();
  }

  function next() {
    if (!answered || busy || !app.classList.contains("revealed")) return;
    pos++;
    render();
  }

  // Desfaz apenas a última resposta (um nível só) e reabre a pergunta.
  async function goBack() {
    if (!lastVote || busy) return;
    busy = true;

    const v = lastVote;
    lastVote = null;
    app.classList.remove("has-last");

    await Stats.undo(v.id, v.side, v.counted);
    busy = false;

    const idx = order.findIndex((q) => q.id === v.id);
    if (idx >= 0) {
      pos = idx;
    } else {
      order.splice(pos, 0, Q.find((q) => q.id === v.id));
    }
    $("end").classList.remove("show");
    render();
  }

  function restart() {
    const s = Stats.load();
    s.seen = [];
    Stats.save(s);
    lastVote = null;
    $("end").classList.remove("show");
    buildOrder();
    render();
  }

  optA.addEventListener("click", () => choose("a"));
  optB.addEventListener("click", () => choose("b"));
  $("next").addEventListener("click", next);
  $("back").addEventListener("click", goBack);
  $("backEnd").addEventListener("click", goBack);
  $("restart").addEventListener("click", restart);

  // Atalhos de teclado (para computador)
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") choose("a");
    else if (e.key === "ArrowRight") choose("b");
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      next();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      goBack();
    }
  });

  buildOrder();
  render();
})();