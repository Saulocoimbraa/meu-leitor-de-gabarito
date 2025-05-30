
GabaritoReader.prototype.startCamera = async function () {
    try {
        this.updateStatus('Iniciando câmera...', 'info');

        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = this.stream;
        this.video.style.display = 'block';

        document.getElementById('startCamera').disabled = true;
        document.getElementById('capture').disabled = false;

        this.updateStatus('Posicione o gabarito na câmera e clique em Capturar', 'success');
    } catch (error) {
        console.error('Erro ao acessar câmera:', error);
        this.updateStatus('Erro ao acessar a câmera. Verifique as permissões.', 'error');
    }
};

GabaritoReader.prototype.captureImage = function () {
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;

    this.canvas.width = videoWidth;
    this.canvas.height = videoHeight;

    this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

    const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
    this.capturedImage.src = imageData;
    this.capturedImage.style.display = 'block';
    this.video.style.display = 'none';

    document.getElementById('capture').disabled = true;
    document.getElementById('process').disabled = false;
    document.getElementById('retake').disabled = false;

    this.updateStatus('Imagem capturada! Clique em "Processar Gabarito".', 'success');
};

GabaritoReader.prototype.retakePhoto = function () {
    this.capturedImage.style.display = 'none';
    this.video.style.display = 'block';

    document.getElementById('capture').disabled = false;
    document.getElementById('process').disabled = true;
    document.getElementById('retake').disabled = true;
    document.getElementById('resultsSection').style.display = 'none';

    this.updateStatus('Posicione o gabarito na câmera e clique em Capturar', 'info');
};
