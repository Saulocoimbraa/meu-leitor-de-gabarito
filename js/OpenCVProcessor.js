
GabaritoReader.prototype.processImage = function () {
    if (!this.opencvReady) {
        this.updateStatus('OpenCV ainda não está pronto. Tente novamente em alguns segundos.', 'error');
        return;
    }

    this.updateStatus('Processando imagem com OpenCV...', 'info');

    try {
        const detectedAnswers = this.detectAnswersWithOpenCV();
        this.displayResults(detectedAnswers);
    } catch (error) {
        console.error('Erro no processamento:', error);
        this.updateStatus('Erro no processamento. Usando detecção simulada...', 'error');
        setTimeout(() => {
            const detectedAnswers = this.simulateAnswerDetection();
            this.displayResults(detectedAnswers);
        }, 1000);
    }
};
