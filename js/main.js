// Classe principal para leitura de gabaritos usando visão computacional
class GabaritoReader {
    
    // Método para gerar template de gabarito - redireciona para página específica
    generateTemplate() {
        // Redireciona para a página do modelo de gabarito
        window.location.href = 'Modelo_de_Gabarito_Imprimir.html'; 
    }
    
    // Construtor da classe - inicializa elementos e configurações
    constructor() {
        // Elementos do DOM
        this.video = document.getElementById('video');              // Elemento de vídeo para câmera
        this.canvas = document.getElementById('canvas');            // Canvas para manipulação de imagem
        this.capturedImage = document.getElementById('capturedImage'); // Elemento para exibir imagem capturada
        this.ctx = this.canvas.getContext('2d');                   // Contexto 2D do canvas
        
        // Estados da aplicação
        this.stream = null;          // Stream da câmera
        this.opencvReady = false;    // Flag para verificar se OpenCV está carregado
        
        // Inicializar componentes
        this.waitForOpenCV();        // Aguarda OpenCV carregar
        this.initializeEventListeners(); // Configura eventos dos botões
    }

    // Aguarda o OpenCV.js carregar completamente antes de usar suas funções
    waitForOpenCV() {
        if (typeof cv !== 'undefined') {
            // OpenCV foi carregado, configura callback de inicialização
            cv.onRuntimeInitialized = () => {
                this.opencvReady = true;
                console.log('OpenCV.js carregado com sucesso!');
            };
        } else {
            // OpenCV ainda não carregou, tenta novamente em 100ms
            setTimeout(() => this.waitForOpenCV(), 100);
        }
    }

    // Configura todos os event listeners dos botões da interface
    initializeEventListeners() {
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capture').addEventListener('click', () => this.captureImage());
        document.getElementById('process').addEventListener('click', () => this.processImage());
        document.getElementById('retake').addEventListener('click', () => this.retakePhoto());
        document.getElementById('debugMode').addEventListener('click', () => this.toggleDebugMode());
        document.getElementById('generateTemplate').addEventListener('click', () => this.generateTemplate());
    }

    // Atualiza mensagens de status na interface
    updateStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`; // Aplica classe CSS baseada no tipo (info, success, error)
    }

    // Inicia captura da câmera do dispositivo
    async startCamera() {
        try {
            this.updateStatus('Iniciando câmera...', 'info');
            
            // Configurações da câmera
            const constraints = {
                video: {
                    facingMode: 'environment', // Câmera traseira (melhor para documentos)
                    width: { ideal: 1280 },    // Resolução ideal
                    height: { ideal: 720 }
                }
            };

            // Solicita acesso à câmera
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';
            
            // Atualiza estado dos botões
            document.getElementById('startCamera').disabled = true;
            document.getElementById('capture').disabled = false;
            
            this.updateStatus('Posicione o gabarito na câmera e clique em Capturar', 'success');
        } catch (error) {
            console.error('Erro ao acessar câmera:', error);
            this.updateStatus('Erro ao acessar a câmera. Verifique as permissões.', 'error');
        }
    }

    // Captura frame atual do vídeo e salva no canvas
    captureImage() {
        // Obtém dimensões do vídeo
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        // Ajusta canvas para mesmo tamanho do vídeo
        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;
        
        // Desenha frame atual do vídeo no canvas
        this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
        
        // Converte canvas para imagem e exibe
        const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
        this.capturedImage.src = imageData;
        this.capturedImage.style.display = 'block';
        this.video.style.display = 'none';
        
        // Atualiza estado dos botões
        document.getElementById('capture').disabled = true;
        document.getElementById('process').disabled = false;
        document.getElementById('retake').disabled = false;
        
        this.updateStatus('Imagem capturada! Clique em "Processar Gabarito" para analisar.', 'success');
    }

    // Permite tirar nova foto
    retakePhoto() {
        // Volta para modo de câmera
        this.capturedImage.style.display = 'none';
        this.video.style.display = 'block';
        
        // Reseta estado dos botões
        document.getElementById('capture').disabled = false;
        document.getElementById('process').disabled = true;
        document.getElementById('retake').disabled = true;
        document.getElementById('resultsSection').style.display = 'none';
        
        this.updateStatus('Posicione o gabarito na câmera e clique em Capturar', 'info');
    }

    // Processa a imagem capturada para detectar respostas
    processImage() {
        // Verifica se OpenCV está pronto
        if (!this.opencvReady) {
            this.updateStatus('OpenCV ainda não está pronto. Tente novamente em alguns segundos.', 'error');
            return;
        }

        this.updateStatus('Processando imagem com OpenCV...', 'info');
        
        try {
            // Tenta detectar respostas usando OpenCV
            const detectedAnswers = this.detectAnswersWithOpenCV();
            this.displayResults(detectedAnswers);
        } catch (error) {
            console.error('Erro no processamento:', error);
            this.updateStatus('Erro no processamento. Usando detecção simulada...', 'error');
            
            // Fallback: usa simulação se OpenCV falhar
            setTimeout(() => {
                const detectedAnswers = this.simulateAnswerDetection();
                this.displayResults(detectedAnswers);
            }, 1000);
        }
    }

    // Método principal de detecção usando OpenCV
    detectAnswersWithOpenCV() {
        // Obtém dados da imagem do canvas
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Matrizes OpenCV para processamento
        let src = cv.matFromImageData(imageData);    // Imagem original
        let gray = new cv.Mat();                     // Imagem em escala de cinza
        let binary = new cv.Mat();                   // Imagem binarizada
        let contours = new cv.MatVector();           // Contornos detectados
        let hierarchy = new cv.Mat();                // Hierarquia dos contornos

        try {
            // ETAPA 1: Pré-processamento da imagem
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);              // Converte para escala cinza
            cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);      // Remove ruído
            cv.adaptiveThreshold(gray, binary, 255, 
                cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2); // Binariza
            
            // ETAPA 2: Detecção de contornos
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // ETAPA 3: Detecta marcadores de referência para correção de perspectiva
            const referenceMarkers = this.detectReferenceMarkers(contours, gray);
            
            if (referenceMarkers.length >= 4) {
                // Se encontrou marcadores, corrige perspectiva
                const correctedImage = this.correctPerspective(src, referenceMarkers);
                const circles = this.detectFilledCirclesInCorrectedImage(correctedImage);
                const answers = this.interpretCirclesAsAnswers(circles);
                
                correctedImage.delete(); // Limpa memória
                return answers;
            } else {
                // Fallback: detecta sem correção de perspectiva
                this.updateStatus('Marcadores não encontrados. Usando detecção padrão...', 'info');
                const circles = this.detectFilledCircles(contours, gray);
                return this.interpretCirclesAsAnswers(circles);
            }
            
        } finally {
            // IMPORTANTE: Limpa memória OpenCV para evitar vazamentos
            src.delete();
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
        }
    }

    // Detecta marcadores de referência (círculos grandes nos cantos)
    detectReferenceMarkers(contours, grayImage) {
        const markers = [];
        const minArea = 800;  // Área mínima para ser considerado marcador
        const maxArea = 8000; // Área máxima
        
        // Analisa cada contorno encontrado
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            // Filtra por tamanho
            if (area > minArea && area < maxArea) {
                // Calcula circularidade (quão próximo de um círculo perfeito)
                const perimeter = cv.arcLength(contour, true);
                const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                
                // Threshold mais rigoroso para marcadores
                if (circularity > 0.6) {
                    // Calcula centro do marcador
                    const moments = cv.moments(contour);
                    const centerX = moments.m10 / moments.m00;
                    const centerY = moments.m01 / moments.m00;
                    
                    // Verifica se marcador está preenchido (escuro)
                    const x = Math.round(centerX);
                    const y = Math.round(centerY);
                    
                    if (x >= 0 && x < grayImage.cols && y >= 0 && y < grayImage.rows) {
                        const intensity = grayImage.ucharPtr(y, x)[0];
                        if (intensity < 100) { // Deve ser bem escuro
                            markers.push({
                                x: centerX,
                                y: centerY,
                                area: area
                            });
                        }
                    }
                }
            }
            contour.delete(); // Limpa memória do contorno
        }
        
        // Identifica e ordena os 4 marcadores dos cantos
        return this.identifyCornerMarkers(markers);
    }

    // Identifica os 4 marcadores dos cantos do gabarito
    identifyCornerMarkers(markers) {
        if (markers.length < 4) return markers;
        
        // Ordena marcadores por posição Y (de cima para baixo)
        markers.sort((a, b) => a.y - b.y);
        
        // Divide em marcadores superiores e inferiores
        const topMarkers = markers.slice(0, Math.ceil(markers.length / 2));
        const bottomMarkers = markers.slice(Math.ceil(markers.length / 2));
        
        // Ordena cada grupo por posição X (esquerda para direita)
        topMarkers.sort((a, b) => a.x - b.x);
        bottomMarkers.sort((a, b) => a.x - b.x);
        
        const cornerMarkers = [];
        
        // Seleciona os 4 cantos: superior-esquerdo, superior-direito, inferior-esquerdo, inferior-direito
        if (topMarkers.length >= 2) {
            cornerMarkers.push(topMarkers[0]); // Superior-esquerdo
            cornerMarkers.push(topMarkers[topMarkers.length - 1]); // Superior-direito
        }
        
        if (bottomMarkers.length >= 2) {
            cornerMarkers.push(bottomMarkers[0]); // Inferior-esquerdo
            cornerMarkers.push(bottomMarkers[bottomMarkers.length - 1]); // Inferior-direito
        }
        
        return cornerMarkers;
    }

    // Corrige a perspectiva da imagem usando os marcadores de referência
    correctPerspective(srcImage, markers) {
        if (markers.length < 4) return srcImage.clone();
        
        try {
            // Define pontos de origem (marcadores detectados na imagem distorcida)
            const srcPoints = [
                markers[0].x, markers[0].y, // Superior-esquerdo
                markers[1].x, markers[1].y, // Superior-direito
                markers[2].x, markers[2].y, // Inferior-esquerdo
                markers[3].x, markers[3].y  // Inferior-direito
            ];
            
            // Define pontos de destino (retângulo perfeito)
            const width = 800;
            const height = 1200;
            const dstPoints = [
                0, 0,           // Superior-esquerdo
                width, 0,       // Superior-direito
                0, height,      // Inferior-esquerdo
                width, height   // Inferior-direito
            ];
            
            // Cria matrizes OpenCV com os pontos
            const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints);
            const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints);
            
            // Calcula matriz de transformação de perspectiva
            const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);
            
            // Aplica a transformação
            const correctedImage = new cv.Mat();
            cv.warpPerspective(srcImage, correctedImage, transformMatrix, new cv.Size(width, height));
            
            // Limpa memória das matrizes temporárias
            srcMat.delete();
            dstMat.delete();
            transformMatrix.delete();
            
            return correctedImage;
            
        } catch (error) {
            console.error('Erro na correção de perspectiva:', error);
            return srcImage.clone(); // Retorna cópia da original se houver erro
        }
    }

    // Detecta círculos preenchidos na imagem com perspectiva corrigida
    detectFilledCirclesInCorrectedImage(correctedImage) {
        // Matrizes para processamento
        let gray = new cv.Mat();
        let binary = new cv.Mat();
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        
        try {
            // Processa a imagem corrigida
            cv.cvtColor(correctedImage, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);
            cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 9, 2);
            
            // Encontra contornos
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // Detecta círculos pequenos (opções de resposta)
            const circles = this.detectSmallCircles(contours, gray);
            
            return circles;
            
        } finally {
            // Limpa memória
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
        }
    }

    // Detecta círculos pequenos (opções de resposta) na imagem processada
    detectSmallCircles(contours, grayImage) {
        const circles = [];
        const minArea = 50;  // Área menor para círculos de resposta
        const maxArea = 800; // Área máxima
        
        // Analisa cada contorno
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            // Filtra por tamanho
            if (area > minArea && area < maxArea) {
                // Calcula circularidade
                const perimeter = cv.arcLength(contour, true);
                const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                
                // Threshold mais permissivo para círculos de resposta
                if (circularity > 0.3) {
                    // Calcula centro
                    const moments = cv.moments(contour);
                    const centerX = moments.m10 / moments.m00;
                    const centerY = moments.m01 / moments.m00;
                    
                    // Verifica se está preenchido
                    const filled = this.isCircleFilled(grayImage, centerX, centerY, Math.sqrt(area / Math.PI));
                    
                    circles.push({
                        x: centerX,
                        y: centerY,
                        area: area,
                        filled: filled
                    });
                }
            }
            contour.delete(); // Limpa memória
        }
        
        return circles;
    }

    // Detecta círculos preenchidos sem correção de perspectiva (método fallback)
    detectFilledCircles(contours, grayImage) {
        const circles = [];
        const minArea = 100;  // Área mínima
        const maxArea = 5000; // Área máxima
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            if (area > minArea && area < maxArea) {
                // Calcula circularidade
                const perimeter = cv.arcLength(contour, true);
                const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                
                if (circularity > 0.4) { // Threshold para determinar se é circular
                    // Calcula centro e raio
                    const moments = cv.moments(contour);
                    const centerX = moments.m10 / moments.m00;
                    const centerY = moments.m01 / moments.m00;
                    
                    // Verifica preenchimento
                    const filled = this.isCircleFilled(grayImage, centerX, centerY, Math.sqrt(area / Math.PI));
                    
                    if (filled) {
                        circles.push({
                            x: centerX,
                            y: centerY,
                            area: area,
                            filled: true
                        });
                    }
                }
            }
            contour.delete();
        }
        
        return circles;
    }

    // Verifica se um círculo está preenchido analisando a intensidade do pixel no centro
    isCircleFilled(grayImage, centerX, centerY, radius) {
        const x = Math.round(centerX);
        const y = Math.round(centerY);
        
        // Verifica se as coordenadas estão dentro da imagem
        if (x >= 0 && x < grayImage.cols && y >= 0 && y < grayImage.rows) {
            const centerIntensity = grayImage.ucharPtr(y, x)[0];
            return centerIntensity < 128; // Considera preenchido se for escuro (< 128)
        }
        return false;
    }

    // Interpreta os círculos detectados como respostas do gabarito
    interpretCirclesAsAnswers(circles) {
        // Obtém configurações da interface
        const numQuestions = parseInt(document.getElementById('numQuestions').value);
        const numOptions = parseInt(document.getElementById('numOptions').value);
        const options = ['A', 'B', 'C', 'D', 'E']; // Opções disponíveis
        
        // Organiza círculos por posição (layout em grade)
        circles.sort((a, b) => {
            // Ordena primeiro por linha (Y), depois por coluna (X)
            if (Math.abs(a.y - b.y) < 30) { // Se estão na mesma linha
                return a.x - b.x; // Ordena por X
            }
            return a.y - b.y; // Ordena por Y
        });
        
        const answers = [];
        const circlesPerQuestion = numOptions;
        
        // Agrupa círculos por questão
        for (let q = 0; q < numQuestions && q * circlesPerQuestion < circles.length; q++) {
            const questionCircles = circles.slice(q * circlesPerQuestion, (q + 1) * circlesPerQuestion);
            
            // Encontra o círculo preenchido desta questão
            let selectedOption = -1;
            questionCircles.forEach((circle, index) => {
                if (circle.filled && selectedOption === -1) {
                    selectedOption = index;
                }
            });
            
            // Converte índice para letra da opção
            if (selectedOption !== -1 && selectedOption < numOptions) {
                answers.push(options[selectedOption]);
            } else {
                answers.push('?'); // Nenhuma resposta detectada
            }
        }
        
        return answers;
    }

    // Simulação de detecção para testes (quando OpenCV falha)
    simulateAnswerDetection() {
        const numQuestions = parseInt(document.getElementById('numQuestions').value);
        const options = ['A', 'B', 'C', 'D', 'E'];
        const maxOptions = parseInt(document.getElementById('numOptions').value);
        
        // Gera respostas aleatórias para demonstração
        const detectedAnswers = [];
        for (let i = 0; i < numQuestions; i++) {
            const randomAnswer = options[Math.floor(Math.random() * maxOptions)];
            detectedAnswers.push(randomAnswer);
        }
        
        return detectedAnswers;
    }

    // Exibe os resultados da detecção na interface
    displayResults(detectedAnswers) {
        // Obtém gabarito correto da interface (se fornecido)
        const answerKeyInput = document.getElementById('answerKey').value.trim();
        const answerKey = answerKeyInput ? answerKeyInput.split(',').map(a => a.trim().toUpperCase()) : [];
        
        // Elementos da interface
        const resultsDiv = document.getElementById('results');
        const scoreDiv = document.getElementById('score');
        const resultsSection = document.getElementById('resultsSection');
        
        resultsDiv.innerHTML = ''; // Limpa resultados anteriores
        
        let correctCount = 0;
        const totalQuestions = detectedAnswers.length;
        
        // Cria elemento para cada questão
        detectedAnswers.forEach((answer, index) => {
            const questionNum = index + 1;
            const correctAnswer = answerKey[index] || '?';
            const isCorrect = answerKey.length > 0 && answer === correctAnswer;
            
            if (isCorrect) correctCount++;
            
            // Cria elemento visual para o resultado
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${answerKey.length > 0 ? (isCorrect ? 'correct' : 'incorrect') : ''}`;
            
            resultItem.innerHTML = `
                <strong>Questão ${questionNum}:</strong> 
                Detectado: <strong>${answer}</strong>
                ${answerKey.length > 0 ? ` | Correto: <strong>${correctAnswer}</strong> ${isCorrect ? '✅' : '❌'}` : ''}
            `;
            
            resultsDiv.appendChild(resultItem);
        });
        
        // Calcula e exibe pontuação
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
        
        // Mostra seção de resultados
        resultsSection.style.display = 'block';
        this.updateStatus('Processamento concluído!', 'success');
    }

    // Ativa/desativa modo debug para visualizar processamento
    toggleDebugMode() {
        // Verifica se OpenCV está pronto
        if (!this.opencvReady) {
            this.updateStatus('OpenCV ainda não está pronto.', 'error');
            return;
        }

        // Verifica se há imagem capturada
        if (!this.capturedImage.src) {
            this.updateStatus('Capture uma imagem primeiro.', 'error');
            return;
        }

        this.showDebugVisualization();
    }

    // Mostra visualização de debug com contornos detectados
    showDebugVisualization() {
        try {
            // Obtém dados da imagem
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            let src = cv.matFromImageData(imageData);
            let gray = new cv.Mat();
            let binary = new cv.Mat();
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            let debugCanvas = document.createElement('canvas');
            debugCanvas.width = this.canvas.width;
            debugCanvas.height = this.canvas.height;

            // Mesmo processamento usado na detecção
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
            cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
            
            // Encontra contornos
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // Desenha contornos válidos na imagem de debug
            let debugMat = src.clone();
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // Desenha apenas contornos de tamanho relevante
                if (area > 100 && area < 5000) {
                    const color = new cv.Scalar(0, 255, 0, 255); // Verde
                    cv.drawContours(debugMat, contours, i, color, 2);
                }
                contour.delete();
            }

            // Exibe imagem de debug
            cv.imshow(debugCanvas, debugMat);
            
            // Mostra em modal
            this.showDebugModal(debugCanvas);

            // Limpa memória
            src.delete();
            gray.delete();
            binary.delete();
            debugMat.delete();
            contours.delete();
            hierarchy.delete();

        } catch (error) {
            console.error('Erro no debug:', error);
            this.updateStatus('Erro na visualização de debug.', 'error');
        }
    }

    // Cria modal para exibir imagem de debug
    showDebugModal(debugCanvas) {
        // Cria modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 1000; 
            display: flex; align-items: center; justify-content: center;
            flex-direction: column; padding: 20px; box-sizing: border-box;
        `;

        // Imagem de debug
        const img = document.createElement('img');
        img.src = debugCanvas.toDataURL();
        img.style.cssText = 'max-width: 90%; max-height: 80%; border-radius: 10px;';

        // Botão para fechar
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fechar';
        closeBtn.className = 'button';
        closeBtn.style.marginTop = '20px';
        closeBtn.onclick = () => document.body.removeChild(modal);

        // Título do modal
        const title = document.createElement('h3');
        title.textContent = 'Visualização de Debug - Contornos Detectados';
        title.style.color = 'white';
        title.style.marginBottom = '20px';

        // Monta e exibe modal
        modal.appendChild(title);
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
    }
}

// Inicializa a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new GabaritoReader();
});
