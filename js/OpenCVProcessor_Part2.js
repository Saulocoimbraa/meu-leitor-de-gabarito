
GabaritoReader.prototype.detectAnswersWithOpenCV = function () {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    let src = cv.matFromImageData(imageData);
    let gray = new cv.Mat();
    let binary = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    try {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const referenceMarkers = this.detectReferenceMarkers(contours, gray);

        if (referenceMarkers.length >= 4) {
            const correctedImage = this.correctPerspective(src, referenceMarkers);
            const circles = this.detectFilledCirclesInCorrectedImage(correctedImage);
            const answers = this.interpretCirclesAsAnswers(circles);
            correctedImage.delete();
            return answers;
        } else {
            this.updateStatus('Marcadores não encontrados. Usando detecção padrão...', 'info');
            const circles = this.detectFilledCircles(contours, gray);
            return this.interpretCirclesAsAnswers(circles);
        }
    } finally {
        src.delete();
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
    }
};
