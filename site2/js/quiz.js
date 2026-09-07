/* =========================================================
   LA TERMITIÈRE — Quiz "Testez vos connaissances"
   Questions chargees depuis data/quizquestions.json (modifiable
   depuis l'espace de publication). Score calcule dans le
   navigateur. Si le score donne droit a un lot, le gain est
   envoye a publish-proxy (nom, telephone, score) pour que
   l'equipe puisse le verifier avant de le remettre.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const PUBLISH_PROXY_ORIGIN = 'https://publier.latermitiere.com';

  const introEl = document.getElementById('quiz-intro');
  const formEl = document.getElementById('quiz-form');
  const questionsEl = document.getElementById('quiz-questions');
  const resultEl = document.getElementById('quiz-result');
  const startBtn = document.getElementById('quiz-start');
  const restartBtn = document.getElementById('quiz-restart');

  if (!introEl || !formEl) return;

  let questions = [];

  function renderQuestions() {
    questionsEl.innerHTML = '';
    questions.forEach((q, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'quiz-question';
      const options = [
        ['A', q.optionA],
        ['B', q.optionB],
        ['C', q.optionC],
        ['D', q.optionD],
      ];
      wrap.innerHTML = `
        <p class="quiz-progress">Question ${index + 1} / ${questions.length}</p>
        <h3>${q.title}</h3>
        <div class="quiz-options">
          ${options.map(([letter, text]) => `
            <label class="quiz-option">
              <input type="radio" name="q${index}" value="${letter}" required>
              <span>${text}</span>
            </label>
          `).join('')}
        </div>`;
      wrap.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', () => {
          wrap.querySelectorAll('.quiz-option').forEach((opt) => opt.classList.remove('selected'));
          input.closest('.quiz-option').classList.add('selected');
        });
      });
      questionsEl.appendChild(wrap);
    });
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

  startBtn.addEventListener('click', () => {
    if (!questions.length) return;
    renderQuestions();
    introEl.hidden = true;
    formEl.hidden = false;
    window.scrollTo({ top: formEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    let score = 0;
    questions.forEach((q, index) => {
      const selected = formEl.querySelector(`input[name="q${index}"]:checked`);
      if (selected && selected.value === q.correct) score += 1;
    });
    const total = questions.length;

    formEl.hidden = true;
    resultEl.hidden = false;
    document.getElementById('quiz-score-value').textContent = score;
    document.getElementById('quiz-score-total').textContent = total;
    document.getElementById('quiz-appreciation').textContent = appreciationForScore(score, total);

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
  });

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
    formEl.reset();
    formEl.hidden = true;
    resultEl.hidden = true;
    claimForm.hidden = false;
    document.getElementById('quiz-claim-done').hidden = true;
    introEl.hidden = false;
    window.scrollTo({ top: introEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  });

  loadQuestions();
});
