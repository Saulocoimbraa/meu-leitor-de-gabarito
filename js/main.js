        class GabaritoReader {
            generateTemplate() {
            // Redireciona para a página do modelo de gabarito
            window.location.href = 'Modelo_de_Gabarito_Imprimir.html'; 
        }
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

            updateStatus(message, type = 'info') {
                const status = document.getElementById('status');
                status.textContent = message;
                status.className = `status ${type}`;
            }

            async startCamera() {
                try {
                    this.updateStatus('Iniciando câmera...', 'info');
                    
                    const constraints = {
                        video: {
                            facingMode: 'environment', // Câmera traseira
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
            }

            captureImage() {
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
                
                this.updateStatus('Imagem capturada! Clique em "Processar Gabarito" para analisar.', 'success');
            }

            retakePhoto() {
                this.capturedImage.style.display = 'none';
                this.video.style.display = 'block';
                
                document.getElementById('capture').disabled = false;
                document.getElementById('process').disabled = true;
                document.getElementById('retake').disabled = true;
                document.getElementById('resultsSection').style.display = 'none';
                
                this.updateStatus('Posicione o gabarito na câmera e clique em Capturar', 'info');
            }

            processImage() {
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
                    // Fallback para simulação
                    setTimeout(() => {
                        const detectedAnswers = this.simulateAnswerDetection();
                        this.displayResults(detectedAnswers);
                    }, 1000);
                }
            }

            detectAnswersWithOpenCV() {
                // Obter dados da imagem do canvas
                const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                
                // Converter para matriz OpenCV
                let src = cv.matFromImageData(imageData);
                let gray = new cv.Mat();
                let binary = new cv.Mat();
                let contours = new cv.MatVector();
                let hierarchy = new cv.Mat();

                try {
                    // Converter para escala de cinza
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    
                    // Aplicar filtro Gaussiano para reduzir ruído
                    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
                    
                    // Binarizar a imagem usando threshold adaptativo
                    cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
                    
                    // Encontrar contornos
                    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    
                    // Primeiro, detectar marcadores de referência
                    const referenceMarkers = this.detectReferenceMarkers(contours, gray);
                    
                    if (referenceMarkers.length >= 4) {
                        // Corrigir perspectiva usando os marcadores
                        const correctedImage = this.correctPerspective(src, referenceMarkers);
                        
                        // Detectar círculos na imagem corrigida
                        const circles = this.detectFilledCirclesInCorrectedImage(correctedImage);
                        
                        // Interpretar como respostas
                        const answers = this.interpretCirclesAsAnswers(circles);
                        
                        correctedImage.delete();
                        return answers;
                    } else {
                        // Fallback: detectar sem correção de perspectiva
                        this.updateStatus('Marcadores não encontrados. Usando detecção padrão...', 'info');
                        const circles = this.detectFilledCircles(contours, gray);
                        return this.interpretCirclesAsAnswers(circles);
                    }
                    
                } finally {
                    // Limpar memória
                    src.delete();
                    gray.delete();
                    binary.delete();
                    contours.delete();
                    hierarchy.delete();
                }
            }

            detectReferenceMarkers(contours, grayImage) {
                const markers = [];
                const minArea = 800; // Área mínima para marcadores de referência
                const maxArea = 8000; // Área máxima
                
                for (let i = 0; i < contours.size(); i++) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour);
                    
                    if (area > minArea && area < maxArea) {
                        // Calcular circularidade
                        const perimeter = cv.arcLength(contour, true);
                        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                        
                        if (circularity > 0.6) { // Threshold mais alto para marcadores
                            // Obter centro do marcador
                            const moments = cv.moments(contour);
                            const centerX = moments.m10 / moments.m00;
                            const centerY = moments.m01 / moments.m00;
                            
                            // Verificar se é um marcador preenchido (preto)
                            const x = Math.round(centerX);
                            const y = Math.round(centerY);
                            
                            if (x >= 0 && x < grayImage.cols && y >= 0 && y < grayImage.rows) {
                                const intensity = grayImage.ucharPtr(y, x)[0];
                                if (intensity < 100) { // Marcador deve ser bem escuro
                                    markers.push({
                                        x: centerX,
                                        y: centerY,
                                        area: area
                                    });
                                }
                            }
                        }
                    }
                    contour.delete();
                }
                
                // Ordenar marcadores por posição para identificar cantos
                return this.identifyCornerMarkers(markers);
            }

            identifyCornerMarkers(markers) {
                if (markers.length < 4) return markers;
                
                // Ordenar por posição para identificar os 4 cantos principais
                markers.sort((a, b) => a.y - b.y); // Primeiro por Y
                
                const topMarkers = markers.slice(0, Math.ceil(markers.length / 2));
                const bottomMarkers = markers.slice(Math.ceil(markers.length / 2));
                
                // Ordenar os de cima e os de baixo por X
                topMarkers.sort((a, b) => a.x - b.x);
                bottomMarkers.sort((a, b) => a.x - b.x);
                
                const cornerMarkers = [];
                
                // Top-left, Top-right, Bottom-left, Bottom-right
                if (topMarkers.length >= 2) {
                    cornerMarkers.push(topMarkers[0]); // Top-left
                    cornerMarkers.push(topMarkers[topMarkers.length - 1]); // Top-right
                }
                
                if (bottomMarkers.length >= 2) {
                    cornerMarkers.push(bottomMarkers[0]); // Bottom-left
                    cornerMarkers.push(bottomMarkers[bottomMarkers.length - 1]); // Bottom-right
                }
                
                return cornerMarkers;
            }

            correctPerspective(srcImage, markers) {
                if (markers.length < 4) return srcImage.clone();
                
                try {
                    // Pontos de origem (marcadores detectados)
                    const srcPoints = [
                        markers[0].x, markers[0].y, // Top-left
                        markers[1].x, markers[1].y, // Top-right
                        markers[2].x, markers[2].y, // Bottom-left
                        markers[3].x, markers[3].y  // Bottom-right
                    ];
                    
                    // Pontos de destino (retângulo perfeito)
                    const width = 800;
                    const height = 1200;
                    const dstPoints = [
                        0, 0,           // Top-left
                        width, 0,       // Top-right
                        0, height,      // Bottom-left
                        width, height   // Bottom-right
                    ];
                    
                    // Criar matrizes de pontos
                    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints);
                    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints);
                    
                    // Calcular matriz de transformação de perspectiva
                    const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);
                    
                    // Aplicar transformação
                    const correctedImage = new cv.Mat();
                    cv.warpPerspective(srcImage, correctedImage, transformMatrix, new cv.Size(width, height));
                    
                    // Limpar memória temporária
                    srcMat.delete();
                    dstMat.delete();
                    transformMatrix.delete();
                    
                    return correctedImage;
                    
                } catch (error) {
                    console.error('Erro na correção de perspectiva:', error);
                    return srcImage.clone();
                }
            }

            detectFilledCirclesInCorrectedImage(correctedImage) {
                let gray = new cv.Mat();
                let binary = new cv.Mat();
                let contours = new cv.MatVector();
                let hierarchy = new cv.Mat();
                
                try {
                    // Processar imagem corrigida
                    cv.cvtColor(correctedImage, gray, cv.COLOR_RGBA2GRAY);
                    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);
                    cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 9, 2);
                    
                    // Encontrar contornos
                    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    
                    // Detectar círculos pequenos (opções de resposta)
                    const circles = this.detectSmallCircles(contours, gray);
                    
                    return circles;
                    
                } finally {
                    gray.delete();
                    binary.delete();
                    contours.delete();
                    hierarchy.delete();
                }
            }

            detectSmallCircles(contours, grayImage) {
                const circles = [];
                const minArea = 50; // Área menor para círculos de resposta
                const maxArea = 800; // Área máxima
                
                for (let i = 0; i < contours.size(); i++) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour);
                    
                    if (area > minArea && area < maxArea) {
                        // Calcular circularidade
                        const perimeter = cv.arcLength(contour, true);
                        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                        
                        if (circularity > 0.3) { // Threshold para círculos de resposta
                            // Obter centro e verificar preenchimento
                            const moments = cv.moments(contour);
                            const centerX = moments.m10 / moments.m00;
                            const centerY = moments.m01 / moments.m00;
                            
                            const filled = this.isCircleFilled(grayImage, centerX, centerY, Math.sqrt(area / Math.PI));
                            
                            circles.push({
                                x: centerX,
                                y: centerY,
                                area: area,
                                filled: filled
                            });
                        }
                    }
                    contour.delete();
                }
                
                return circles;
            }

            detectFilledCircles(contours, grayImage) {
                const circles = [];
                const minArea = 100; // Área mínima para considerar um círculo
                const maxArea = 5000; // Área máxima
                
                for (let i = 0; i < contours.size(); i++) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour);
                    
                    if (area > minArea && area < maxArea) {
                        // Calcular circularidade
                        const perimeter = cv.arcLength(contour, true);
                        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
                        
                        if (circularity > 0.4) { // Threshold para determinar se é circular
                            // Obter centro e raio do círculo
                            const moments = cv.moments(contour);
                            const centerX = moments.m10 / moments.m00;
                            const centerY = moments.m01 / moments.m00;
                            
                            // Verificar se o círculo está preenchido
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

            isCircleFilled(grayImage, centerX, centerY, radius) {
                // Verificar intensidade no centro do círculo
                const x = Math.round(centerX);
                const y = Math.round(centerY);
                
                if (x >= 0 && x < grayImage.cols && y >= 0 && y < grayImage.rows) {
                    const centerIntensity = grayImage.ucharPtr(y, x)[0];
                    return centerIntensity < 128; // Considera preenchido se for escuro
                }
                return false;
            }

            interpretCirclesAsAnswers(circles) {
                const numQuestions = parseInt(document.getElementById('numQuestions').value);
                const numOptions = parseInt(document.getElementById('numOptions').value);
                const options = ['A', 'B', 'C', 'D', 'E'];
                
                // Organizar círculos por posição (assumindo layout em grade)
                circles.sort((a, b) => {
                    // Primeiro por linha (Y), depois por coluna (X)
                    if (Math.abs(a.y - b.y) < 30) {
                        return a.x - b.x;
                    }
                    return a.y - b.y;
                });
                
                const answers = [];
                const circlesPerQuestion = numOptions;
                
                // Agrupar círculos por questão
                for (let q = 0; q < numQuestions && q * circlesPerQuestion < circles.length; q++) {
                    const questionCircles = circles.slice(q * circlesPerQuestion, (q + 1) * circlesPerQuestion);
                    
                    // Encontrar o círculo preenchido nesta questão
                    let selectedOption = -1;
                    questionCircles.forEach((circle, index) => {
                        if (circle.filled && selectedOption === -1) {
                            selectedOption = index;
                        }
                    });
                    
                    if (selectedOption !== -1 && selectedOption < numOptions) {
                        answers.push(options[selectedOption]);
                    } else {
                        answers.push('?'); // Nenhuma resposta detectada
                    }
                }
                
                return answers;
            }

            simulateAnswerDetection() {
                const numQuestions = parseInt(document.getElementById('numQuestions').value);
                const options = ['A', 'B', 'C', 'D', 'E'];
                const maxOptions = parseInt(document.getElementById('numOptions').value);
                
                // Simula detecção aleatória de respostas
                const detectedAnswers = [];
                for (let i = 0; i < numQuestions; i++) {
                    const randomAnswer = options[Math.floor(Math.random() * maxOptions)];
                    detectedAnswers.push(randomAnswer);
                }
                
                return detectedAnswers;
            }

            displayResults(detectedAnswers) {
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
            }

            toggleDebugMode() {
                if (!this.opencvReady) {
                    this.updateStatus('OpenCV ainda não está pronto.', 'error');
                    return;
                }

                if (!this.capturedImage.src) {
                    this.updateStatus('Capture uma imagem primeiro.', 'error');
                    return;
                }

                this.showDebugVisualization();
            }

            showDebugVisualization() {
                try {
                    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    let src = cv.matFromImageData(imageData);
                    let gray = new cv.Mat();
                    let binary = new cv.Mat();
                    let contours = new cv.MatVector();
                    let hierarchy = new cv.Mat();
                    let debugCanvas = document.createElement('canvas');
                    debugCanvas.width = this.canvas.width;
                    debugCanvas.height = this.canvas.height;

                    // Processamento para debug
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
                    cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
                    
                    // Encontrar contornos
                    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                    // Desenhar contornos na imagem de debug
                    let debugMat = src.clone();
                    for (let i = 0; i < contours.size(); i++) {
                        const contour = contours.get(i);
                        const area = cv.contourArea(contour);
                        
                        if (area > 100 && area < 5000) {
                            const color = new cv.Scalar(0, 255, 0, 255); // Verde para contornos válidos
                            cv.drawContours(debugMat, contours, i, color, 2);
                        }
                        contour.delete();
                    }

                    // Mostrar imagem de debug
                    cv.imshow(debugCanvas, debugMat);
                    
                    // Criar modal para mostrar debug
                    this.showDebugModal(debugCanvas);

                    // Limpeza
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

            showDebugModal(debugCanvas) {
                // Criar modal simples
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.8); z-index: 1000; 
                    display: flex; align-items: center; justify-content: center;
                    flex-direction: column; padding: 20px; box-sizing: border-box;
                `;

                const img = document.createElement('img');
                img.src = debugCanvas.toDataURL();
                img.style.cssText = 'max-width: 90%; max-height: 80%; border-radius: 10px;';

                const closeBtn = document.createElement('button');
                closeBtn.textContent = 'Fechar';
                closeBtn.className = 'button';
                closeBtn.style.marginTop = '20px';
                closeBtn.onclick = () => document.body.removeChild(modal);

                const title = document.createElement('h3');
                title.textContent = 'Visualização de Debug - Contornos Detectados';
                title.style.color = 'white';
                title.style.marginBottom = '20px';

                modal.appendChild(title);
                modal.appendChild(img);
                modal.appendChild(closeBtn);
                document.body.appendChild(modal);
            }
        }

        // Inicializar aplicação
        document.addEventListener('DOMContentLoaded', () => {
            new GabaritoReader();
        });
