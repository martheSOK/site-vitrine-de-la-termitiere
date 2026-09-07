/* =========================================================
   LA TERMITIÈRE — Quiz "Testez vos connaissances"
   Questions chargees depuis data/quizquestions.json (modifiable
   depuis l'espace de publication). Une question a la fois, avec
   barre de progression. Score calcule dans le navigateur. Si le
   score donne droit a un lot, le gain est envoye a publish-proxy
   (nom, telephone, score) pour que l'equipe puisse le verifier
   avant de le remettre.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const PUBLISH_PROXY_ORIGIN = 'https://publier.latermitiere.com';

  const introEl = document.getElementById('quiz-intro');
  const formEl = document.getElementById('quiz-form');
  const questionsEl = document.getElementById('quiz-questions');
  const resultEl = document.getElementById('quiz-result');
  const startBtn = document.getElementById('quiz-start');
  const restartBtn = document.getElementById('quiz-restart');
  const prevBtn = document.getElementById('quiz-prev');
  const nextBtn = document.getElementById('quiz-next');
  const progressFill = document.getElementById('quiz-progress-fill');
  const progressLabel = document.getElementById('quiz-progress-label');

  if (!introEl || !formEl) return;

  let questions = [];
  let current = 0;
  let answers = [];

  const TIER_ICONS = {
    high: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 4h8v4a4 4 0 01-4 4 4 4 0 01-4-4V4z"/><path d="M8 5H4a3 3 0 003 3M16 5h4a3 3 0 01-3 3"/><path d="M12 12v3M9 19h6M10 19v-2.5M14 19v-2.5"/></svg>',
    mid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6L12 3z"/></svg>',
    low: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z"/></svg>',
  };

  function renderCurrentQuestion() {
    const total = questions.length;
    const q = questions[current];
    const options = [
      ['A', q.optionA],
      ['B', q.optionB],
      ['C', q.optionC],
      ['D', q.optionD],
    ];

    progressFill.style.width = `${(current / total) * 100}%`;
    progressLabel.textContent = `Question ${current + 1} / ${total}`;

    const wrap = document.createElement('div');
    wrap.className = 'quiz-question';
    wrap.innerHTML = `
      <h3>${q.title}</h3>
      <div class="quiz-options">
        ${options.map(([letter, text]) => `
          <label class="quiz-option${answers[current] === letter ? ' selected' : ''}">
            <input type="radio" name="q${current}" value="${letter}" ${answers[current] === letter ? 'checked' : ''}>
            <span class="quiz-option-badge">${letter}</span>
            <span class="quiz-option-text">${text}</span>
          </label>
        `).join('')}
      </div>`;
    wrap.querySelectorAll('.quiz-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const letter = opt.querySelector('input').value;
        answers[current] = letter;
        wrap.querySelectorAll('.quiz-option').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        nextBtn.disabled = false;
      });
    });
    questionsEl.innerHTML = '';
    questionsEl.appendChild(wrap);

    prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    nextBtn.disabled = !answers[current];
    nextBtn.textContent = current === total - 1 ? 'Voir mon résultat' : 'Suivant →';
  }

  async function loadQuestions() {
    try {
      const res = await fetch('data/quizquestions.json', { cache: 'no-store' });
      const data = await res.json();
      questions = data.items || [];
    } catch (err) {
      questions = [];
    }
    if (!questions.length) {
      startBtn.disabled = true;
      startBtn.textContent = 'Quiz momentanément indisponible';
    }
  }

  function prizeForScore(score, total) {
    if (!total) return null;
    const ratio = score / total;
    if (ratio >= 0.8) return "Séance découverte offerte à Maxi Gym";
    if (ratio >= 0.5) return '10% de réduction sur votre première visite à Maxi Gym';
    return null;
  }

  function appreciationForScore(score, total) {
    if (!total) return '';
    const ratio = score / total;
    if (ratio >= 0.8) return 'Excellent ! Vous connaissez très bien La Termitière.';
    if (ratio >= 0.5) return 'Bien joué, vous vous y connaissez déjà pas mal !';
    return "Pas mal, mais il y a encore des choses à découvrir sur le site !";
  }

  function tierForScore(score, total) {
    if (!total) return 'low';
    const ratio = score / total;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'mid';
    return 'low';
  }

  function resetQuizState() {
    current = 0;
    answers = [];
  }

  startBtn.addEventListener('click', () => {
    if (!questions.length) return;
    resetQuizState();
    renderCurrentQuestion();
    introEl.hidden = true;
    formEl.hidden = false;
    window.scrollTo({ top: formEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  });

  prevBtn.addEventListener('click', () => {
    if (current === 0) return;
    current -= 1;
    renderCurrentQuestion();
  });

  nextBtn.addEventListener('click', () => {
    if (!answers[current]) return;
    if (current < questions.length - 1) {
      current += 1;
      renderCurrentQuestion();
      return;
    }
    showResult();
  });

  function showResult() {
    let score = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correct) score += 1;
    });
    const total = questions.length;

    progressFill.style.width = '100%';
    formEl.hidden = true;
    resultEl.hidden = false;
    document.getElementById('quiz-score-value').textContent = score;
    document.getElementById('quiz-score-total').textContent = total;
    document.getElementById('quiz-appreciation').textContent = appreciationForScore(score, total);

    const tier = tierForScore(score, total);
    document.getElementById('quiz-tier-icon').innerHTML = TIER_ICONS[tier];
    const ring = document.getElementById('quiz-score-ring');
    ring.classList.remove('tier-low', 'tier-mid', 'tier-high');
    ring.classList.add(`tier-${tier}`);

    const prize = prizeForScore(score, total);
    const prizeBlock = document.getElementById('quiz-prize-block');
    const prizeText = document.getElementById('quiz-prize-text');
    const claimForm = document.getElementById('quiz-claim-form');
    const claimDone = document.getElementById('quiz-claim-done');

    if (prize) {
      prizeBlock.hidden = false;
      prizeText.textContent = `Vous gagnez : ${prize}`;
      claimForm.hidden = false;
      claimDone.hidden = true;
      claimForm.dataset.score = score;
      claimForm.dataset.total = total;
      claimForm.dataset.prize = prize;
    } else {
      prizeBlock.hidden = true;
    }

    window.scrollTo({ top: resultEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }

  const claimForm = document.getElementById('quiz-claim-form');
  const claimMsg = document.getElementById('quiz-claim-msg');
  claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const honeypot = claimForm.querySelector('input[name="bot-field"]');
    if (honeypot && honeypot.value) return;

    const submitBtn = claimForm.querySelector('button[type="submit"]');
    const name = document.getElementById('qc-name').value.trim();
    const phone = document.getElementById('qc-phone').value.trim();
    if (!name || !phone) {
      claimMsg.textContent = 'Merci de renseigner votre nom et votre téléphone.';
      claimMsg.style.color = '#BD3C2F';
      return;
    }

    submitBtn.disabled = true;
    claimMsg.textContent = 'Envoi en cours…';
    claimMsg.style.color = '';

    try {
      const res = await fetch(`${PUBLISH_PROXY_ORIGIN}/api/quiz-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          score: Number(claimForm.dataset.score),
          total: Number(claimForm.dataset.total),
          prizeLabel: claimForm.dataset.prize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      claimForm.hidden = true;
      document.getElementById('quiz-claim-done').hidden = false;
    } catch (err) {
      claimMsg.textContent = "L'envoi a échoué. Réessaie, ou contacte-nous directement.";
      claimMsg.style.color = '#BD3C2F';
    } finally {
      submitBtn.disabled = false;
    }
  });

  restartBtn.addEventListener('click', () => {
    resetQuizState();
    formEl.hidden = true;
    resultEl.hidden = true;
    claimForm.hidden = false;
    document.getElementById('quiz-claim-done').hidden = true;
    introEl.hidden = false;
    window.scrollTo({ top: introEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  });

  loadQuestions();
});
