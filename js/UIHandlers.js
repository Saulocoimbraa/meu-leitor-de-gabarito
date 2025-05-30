
GabaritoReader.prototype.updateStatus = function (message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
};

GabaritoReader.prototype.displayResults = function (detectedAnswers) {
    const answerKeyInput = document.getElementById('answerKey').value.trim();
    const answerKey = answerKeyInput ? answerKeyInput.split(',').map(a => a.trim().toUpperCase()) : [];

    const resultsDiv = document.getElementById('results');
    const scoreDiv = document.getElementById('score');
    const resultsSection = document.getElementById('resultsSection');

    resultsDiv.innerHTML = '';
    let correctCount = 0;
    const totalQuestions = detectedAnswers.length;

    detectedAnswers.forEach((answer, index) => {
        const questionNum = index + 1;
        const correctAnswer = answerKey[index] || '?';
        const isCorrect = answerKey.length > 0 && answer === correctAnswer;

        if (isCorrect) correctCount++;

        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${answerKey.length > 0 ? (isCorrect ? 'correct' : 'incorrect') : ''}`;
        resultItem.innerHTML = `
            <strong>Questão ${questionNum}:</strong> 
            Detectado: <strong>${answer}</strong>
            ${answerKey.length > 0 ? ` | Correto: <strong>${correctAnswer}</strong> ${isCorrect ? '✅' : '❌'}` : ''}
        `;
        resultsDiv.appendChild(resultItem);
    });

    if (answerKey.length > 0) {
        const percentage = ((correctCount / totalQuestions) * 100).toFixed(1);
        scoreDiv.innerHTML = `
            <div>Pontuação: ${correctCount}/${totalQuestions}</div>
            <div>Percentual: ${percentage}%</div>
        `;
    } else {
        scoreDiv.innerHTML = `
            <div>Respostas detectadas: ${totalQuestions}</div>
            <div style="font-size: 0.9em; color: #666;">Configure o gabarito para ver a correção</div>
        `;
    }

    resultsSection.style.display = 'block';
    this.updateStatus('Processamento concluído!', 'success');
};
