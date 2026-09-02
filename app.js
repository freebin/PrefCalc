(function () {
  "use strict";

  const VIST_RATE = 10; // 1 очко горы = 10 вистов (стандартная конвенция)
  const PLAYER_NAMES = ["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4"];

  const state = {
    n: 3,
    variant: "classic", // "classic" | "leningrad"
    view: "table", // "table" | "pulka"
    players: [
      { pulya: 0, gora: 0 },
      { pulya: 0, gora: 0 },
      { pulya: 0, gora: 0 },
      { pulya: 0, gora: 0 },
    ],
    // table view: net vist per pair, keyed "i-j" (i<j), positive => player i is ahead of player j
    vists: { "0-1": 0, "0-2": 0, "1-2": 0, "0-3": 0, "1-3": 0, "2-3": 0 },
    // pulka view, 3 players: raw directional tallies, as recorded on paper
    // A: 1->3, B: 1->2, C: 2->1, D: 2->3, E: 3->2, F: 3->1
    pulka: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
    // pulka view, 4 players: raw directional tallies (player1=left, player2=bottom, player3=right, player4=top)
    // A:1->4 B:1->3 C:1->2 D:2->1 E:2->4 F:2->3 G:3->2 H:3->1 I:3->4 J:4->3 K:4->2 L:4->1
    pulka4: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0, L: 0 },
  };

  function allPairs() {
    return ["0-1", "0-2", "1-2", "0-3", "1-3", "2-3"];
  }

  function pairsForN(n) {
    const res = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) res.push(i + "-" + j);
    }
    return res;
  }

  function multiplierFor(variant) {
    return variant === "leningrad" ? 2 : 1;
  }

  // net vist for a pair "i-j" (i<j), positive => player i ahead of player j
  function vistNetForPair(key) {
    if (state.view === "pulka" && state.n === 3) {
      const p = state.pulka;
      if (key === "0-1") return (Number(p.B) || 0) - (Number(p.C) || 0);
      if (key === "0-2") return (Number(p.A) || 0) - (Number(p.F) || 0);
      if (key === "1-2") return (Number(p.D) || 0) - (Number(p.E) || 0);
      return 0;
    }
    if (state.view === "pulka" && state.n === 4) {
      const p = state.pulka4;
      if (key === "0-1") return (Number(p.C) || 0) - (Number(p.D) || 0);
      if (key === "0-2") return (Number(p.B) || 0) - (Number(p.H) || 0);
      if (key === "0-3") return (Number(p.A) || 0) - (Number(p.L) || 0);
      if (key === "1-2") return (Number(p.F) || 0) - (Number(p.G) || 0);
      if (key === "1-3") return (Number(p.E) || 0) - (Number(p.K) || 0);
      if (key === "2-3") return (Number(p.I) || 0) - (Number(p.J) || 0);
      return 0;
    }
    return Number(state.vists[key]) || 0;
  }

  function calculate() {
    const n = state.n;
    const mult = multiplierFor(state.variant);
    const players = state.players.slice(0, n);

    const target = Math.max(...players.map((p) => p.pulya));

    const adjGora = players.map(
      (p) => p.gora - (p.pulya - target) * mult
    );
    const sumGora = adjGora.reduce((a, b) => a + b, 0);
    const avgGora = sumGora / n;
    const horka = adjGora.map((g) => (avgGora - g) * VIST_RATE);

    const vistNet = new Array(n).fill(0);
    pairsForN(n).forEach((key) => {
      const [i, j] = key.split("-").map(Number);
      const v = vistNetForPair(key); // positive => i ahead of j
      vistNet[i] += v;
      vistNet[j] -= v;
    });

    const final = horka.map((h, i) => h + vistNet[i]);
    const total = final.reduce((a, b) => a + b, 0);

    return { n, target, mult, adjGora, avgGora, horka, vistNet, final, total };
  }

  function fmt(num) {
    const rounded = Math.round(num * 100) / 100;
    // strip trailing zeros
    return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function render() {
    // toggle player card visibility (table view)
    document.querySelectorAll(".player-card").forEach((card) => {
      const idx = Number(card.dataset.player);
      card.dataset.hidden = idx >= state.n ? "true" : "false";
    });

    // toggle vist rows visibility (table view)
    allPairs().forEach((key) => {
      const row = document.querySelector('.vist-row[data-pair="' + key + '"]');
      const [i, j] = key.split("-").map(Number);
      const visible = j < state.n;
      row.dataset.hidden = visible ? "false" : "true";
    });

    // update vist row labels (table view)
    allPairs().forEach((key) => {
      const [i, j] = key.split("-").map(Number);
      const row = document.querySelector('.vist-row[data-pair="' + key + '"]');
      if (!row) return;
      row.querySelector('[data-side="a"]').textContent = PLAYER_NAMES[i];
      row.querySelector('[data-side="b"]').textContent = PLAYER_NAMES[j];
    });

    document.getElementById("table-view").classList.toggle("hidden", state.view !== "table");
    document.getElementById("pulka-view").classList.toggle("hidden", state.view !== "pulka");
    document.getElementById("pulka-3").classList.toggle("hidden", state.n !== 3);
    document.getElementById("pulka-4").classList.toggle("hidden", state.n !== 4);

    syncPlayerInputs();
    updateResults();
  }

  function syncPlayerInputs() {
    state.players.forEach((p, idx) => {
      document.querySelectorAll('.pulya-input[data-player="' + idx + '"]').forEach((el) => {
        if (document.activeElement !== el) el.value = p.pulya;
      });
      document.querySelectorAll('.gora-input[data-player="' + idx + '"]').forEach((el) => {
        if (document.activeElement !== el) el.value = p.gora;
      });
      document.querySelectorAll('.pk-pulya-input[data-pk-player="' + idx + '"]').forEach((el) => {
        if (document.activeElement !== el) el.value = p.pulya;
      });
      document.querySelectorAll('.pk-gora-input[data-pk-player="' + idx + '"]').forEach((el) => {
        if (document.activeElement !== el) el.value = p.gora;
      });
    });
  }

  function updateVistExplain() {
    allPairs().forEach((key) => {
      const [i, j] = key.split("-").map(Number);
      const el = document.querySelector('.vist-explain[data-pair="' + key + '"]');
      if (!el) return;
      const v = Number(state.vists[key]) || 0;
      if (v === 0) {
        el.textContent = "ничья";
      } else if (v > 0) {
        el.textContent = PLAYER_NAMES[i] + " впереди на " + fmt(v) + " вист(ов)";
      } else {
        el.textContent = PLAYER_NAMES[j] + " впереди на " + fmt(-v) + " вист(ов)";
      }
    });
  }

  function updateResults() {
    const r = calculate();

    // balance banner
    const banner = document.getElementById("balance-banner");
    const eps = 1e-6;
    if (Math.abs(r.total) > eps) {
      banner.className = "banner error";
      banner.textContent =
        "⚠ Сумма итогов не равна нулю (получено " + fmt(r.total) + "). Проверьте введённые данные — где-то ошибка.";
    } else {
      banner.className = "banner ok";
      banner.textContent = "Сумма итогов сходится в ноль — расчёт корректен.";
    }

    // results table
    const body = document.getElementById("results-body");
    body.innerHTML = "";
    for (let i = 0; i < r.n; i++) {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.textContent = PLAYER_NAMES[i];
      const tdVal = document.createElement("td");
      const val = r.final[i];
      const cls = val > eps ? "positive" : val < -eps ? "negative" : "zero";
      tdVal.innerHTML = '<span class="result-value ' + cls + '">' + fmt(val) + "</span>";
      tr.appendChild(tdName);
      tr.appendChild(tdVal);
      body.appendChild(tr);
    }

    // fraction note
    const fracNote = document.getElementById("fraction-note");
    const hasFraction = r.final.some((v) => Math.abs(v - Math.round(v)) > eps);
    fracNote.classList.toggle("hidden", !hasFraction);

    // breakdown table
    const bBody = document.getElementById("breakdown-body");
    bBody.innerHTML = "";
    for (let i = 0; i < r.n; i++) {
      const tr = document.createElement("tr");
      const cells = [
        PLAYER_NAMES[i],
        fmt(state.players[i].gora),
        fmt(r.adjGora[i]),
        fmt(r.avgGora),
        fmt(r.horka[i]),
        fmt(r.vistNet[i]),
        fmt(r.final[i]),
      ];
      cells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      });
      bBody.appendChild(tr);
    }

    updateVistExplain();
  }

  function attachListeners() {
    // player count toggle
    document.querySelectorAll("#player-count-toggle .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.n = Number(btn.dataset.n);
        document
          .querySelectorAll("#player-count-toggle .seg-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    });

    // view toggle
    document.querySelectorAll("#view-toggle .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        state.view = btn.dataset.view;
        document
          .querySelectorAll("#view-toggle .seg-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    });

    // variant select
    document.getElementById("variant-select").addEventListener("change", (e) => {
      state.variant = e.target.value;
      updateResults();
    });

    // player inputs (table view)
    document.querySelectorAll(".pulya-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.player);
        state.players[idx].pulya = Number(e.target.value) || 0;
        syncPlayerInputs();
        updateResults();
      });
    });
    document.querySelectorAll(".gora-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.player);
        state.players[idx].gora = Number(e.target.value) || 0;
        syncPlayerInputs();
        updateResults();
      });
    });

    // player inputs (pulka view)
    document.querySelectorAll(".pk-pulya-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.pkPlayer);
        state.players[idx].pulya = Number(e.target.value) || 0;
        syncPlayerInputs();
        updateResults();
      });
    });
    document.querySelectorAll(".pk-gora-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.pkPlayer);
        state.players[idx].gora = Number(e.target.value) || 0;
        syncPlayerInputs();
        updateResults();
      });
    });

    // vist inputs (table view)
    document.querySelectorAll(".vist-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const key = e.target.dataset.pair;
        state.vists[key] = Number(e.target.value) || 0;
        updateResults();
      });
    });

    // vist inputs (pulka view, 3 players)
    document.querySelectorAll(".pk-vist-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const k = e.target.dataset.pk;
        state.pulka[k] = Number(e.target.value) || 0;
        updateResults();
      });
    });

    // vist inputs (pulka view, 4 players)
    document.querySelectorAll(".pk4-vist-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const k = e.target.dataset.pk;
        state.pulka4[k] = Number(e.target.value) || 0;
        updateResults();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    attachListeners();
    render();
  });
})();
