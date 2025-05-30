
class GabaritoReader {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.capturedImage = document.getElementById('capturedImage');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.opencvReady = false;

        this.waitForOpenCV();
        this.initializeEventListeners();
    }

    generateTemplate() {
        window.location.href = 'Modelo_de_Gabarito_Imprimir.html';
    }

    waitForOpenCV() {
        if (typeof cv !== 'undefined') {
            cv.onRuntimeInitialized = () => {
                this.opencvReady = true;
                console.log('OpenCV.js carregado com sucesso!');
            };
        } else {
            setTimeout(() => this.waitForOpenCV(), 100);
        }
    }

    initializeEventListeners() {
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capture').addEventListener('click', () => this.captureImage());
        document.getElementById('process').addEventListener('click', () => this.processImage());
        document.getElementById('retake').addEventListener('click', () => this.retakePhoto());
        document.getElementById('debugMode').addEventListener('click', () => this.toggleDebugMode());
        document.getElementById('generateTemplate').addEventListener('click', () => this.generateTemplate());
    }
}
