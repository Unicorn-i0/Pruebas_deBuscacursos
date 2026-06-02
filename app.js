// ==========================================================
// 1. CONFIGURACIÓN Y ESTRUCTURAS DE DATOS GLOBALES
// ==========================================================

// Duración del almuerzo (60 minutos)
const ALMUERZO_DURACION = 60; 

// Horario específico del almuerzo
const ALMUERZO_INICIO = 14 * 60 + 20; // 14:20 PM
const ALMUERZO_FIN = 15 * 60 + 20;    // 15:20 PM

// Definición de los slots de tiempo fijos de la tabla
const TIME_SLOTS = [
    { start: "08:30", end: "10:00" }, 
    { start: "10:00", end: "11:30" }, 
    { start: "11:30", end: "13:00" }, 
    { start: "13:00", end: "14:20" }, 
    { start: "14:20", end: "15:20", isLunch: true }, // ALMUERZO
    { start: "15:20", end: "16:50" }, 
    { start: "16:50", end: "18:20" }, 
    { start: "18:20", end: "19:50" }, 
    { start: "19:50", end: "21:20" }, 
    { start: "21:20", end: "22:50" }, 
];

// Almacenamiento de cursos seleccionados para el horario
let horarioSeleccionado = []; 

// Referencias a elementos del DOM
const scheduleTableBody = document.getElementById('schedule-body');
const courseSearchInput = document.getElementById('course-search');
const courseResultsDiv = document.getElementById('course-results');
const sectionSelectionDiv = document.getElementById('section-selection');
const selectedCoursesList = document.getElementById('selected-courses');

// ==========================================================
// 2. UTILIDADES DE TIEMPO Y TEXTO
// ==========================================================

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function findSlotTime(courseStartTimeStr) {
    const courseStartTimeMins = timeToMinutes(courseStartTimeStr);
    
    for (const slot of TIME_SLOTS) {
        const slotStartTimeMins = timeToMinutes(slot.start);
        const slotEndTimeMins = timeToMinutes(slot.end);
        
        if (courseStartTimeMins >= slotStartTimeMins && courseStartTimeMins < slotEndTimeMins) {
            return slot.start;
        }
    }
    return null; 
}

// Remueve tildes y convierte a minúsculas para búsquedas inteligentes
function limpiarTexto(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// ==========================================================
// 3. GENERACIÓN DEL HORARIO (Tabla)
// ==========================================================

function generateScheduleGrid() {
    scheduleTableBody.innerHTML = ''; 

    TIME_SLOTS.forEach(slot => {
        const row = document.createElement('tr');
        const startTime = slot.start;
        const endTime = slot.end;

        const timeCell = document.createElement('td');
        timeCell.textContent = `${startTime} - ${endTime}`;
        timeCell.classList.add('time-label');
        row.appendChild(timeCell);

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; 
        days.forEach(day => {
            const dayCell = document.createElement('td');
            dayCell.dataset.day = day;
            dayCell.dataset.slotTime = startTime; 
            
            if (slot.isLunch) {
                dayCell.textContent = "ALMUERZO";
                dayCell.classList.add('lunch-break');
            }
            
            row.appendChild(dayCell);
        });

        scheduleTableBody.appendChild(row);
    });
}

// ==========================================================
// 4. LÓGICA DE DETECCIÓN Y RECOLECCIÓN DE TOPES
// ==========================================================

function checkConflict(nuevoBloque) {
    const inicioNuevo = timeToMinutes(nuevoBloque.inicio);
    const finNuevo = timeToMinutes(nuevoBloque.fin);

    if (nuevoBloque.dia !== 'Sábado' && inicioNuevo < ALMUERZO_FIN && finNuevo > ALMUERZO_INICIO) {
        return true;
    }

    for (const cursoSeleccionado of horarioSeleccionado) {
        if (cursoSeleccionado.sigla === nuevoBloque.sigla && cursoSeleccionado.seccionId === nuevoBloque.seccionId) {
            continue; 
        }

        for (const bloqueExistente of cursoSeleccionado.horario) {
            if (bloqueExistente.dia === nuevoBloque.dia) {
                const inicioExistente = timeToMinutes(bloqueExistente.inicio);
                const finExistente = timeToMinutes(bloqueExistente.fin);
                
                if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
                    return true; 
                }
            }
        }
    }
    return false;
}

// NUEVO: Devuelve una lista con los nombres específicos de los cursos que generan el tope
function obtenerListadoDeConflictos(seccion, cursoSigla) {
    let conflictos = [];
    
    seccion.horario.forEach(bloque => {
        const inicioNuevo = timeToMinutes(bloque.inicio);
        const finNuevo = timeToMinutes(bloque.fin);

        // Conflicto con almuerzo
        if (bloque.dia !== 'Sábado' && inicioNuevo < ALMUERZO_FIN && finNuevo > ALMUERZO_INICIO) {
            if (!conflictos.includes("Horario de Almuerzo institucional")) {
                conflictos.push("Horario de Almuerzo institucional");
            }
        }

        // Conflicto con asignaturas inscritas
        horarioSeleccionado.forEach(cursoSeleccionado => {
            if (cursoSeleccionado.sigla === cursoSigla) return; // Se omite si reemplaza sección previa del mismo curso

            cursoSeleccionado.horario.forEach(bloqueExistente => {
                if (bloqueExistente.dia === bloque.dia) {
                    const inicioExistente = timeToMinutes(bloqueExistente.inicio);
                    const finExistente = timeToMinutes(bloqueExistente.fin);
                    
                    if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
                        const descripcion = `${cursoSeleccionado.sigla} - Secc. ${cursoSeleccionado.seccionId} (${cursoSeleccionado.nombre})`;
                        if (!conflictos.includes(descripcion)) {
                            conflictos.push(descripcion);
                        }
                    }
                }
            });
        });
    });
    
    return conflictos;
}

// ==========================================================
// 5. MANEJO DE SELECCIÓN DE CURSOS
// ==========================================================

function formatScheduleSummary(horario) {
    return horario.map(bloque => 
        `${bloque.dia}: ${bloque.inicio}-${bloque.fin} (${bloque.tipo})`
    ).join(' | ');
}

function displaySections(curso) {
    sectionSelectionDiv.innerHTML = `<h3>Secciones de ${curso.sigla} - ${curso.nombre}:</h3>`;
    
    const scrollContainer = document.createElement('div');
    scrollContainer.classList.add('sections-scroll-container');

    curso.secciones.forEach(seccion => {
        const sectionContainer = document.createElement('div');
        sectionContainer.classList.add('section-option');

        const button = document.createElement('button');
        button.textContent = `Sección ${seccion.id}`;
        button.classList.add('section-btn');
        
        const isAdded = horarioSeleccionado.some(c => c.sigla === curso.sigla && c.seccionId === seccion.id);
        button.disabled = isAdded;
        if (isAdded) {
            button.textContent += " (Seleccionada)";
        }

        const scheduleSummary = formatScheduleSummary(seccion.horario);
        const summarySpan = document.createElement('span');
        summarySpan.classList.add('schedule-summary');
        summarySpan.textContent = scheduleSummary;

        // --- MANEJO DE PREVISUALIZACIÓN MEDIANTE DIV INTERNO (Evita encimar bloques continuos) ---
        const removePreview = () => {
            renderSchedule(); 
        };

        const previewSchedule = () => {
            renderSchedule(); 
            
            const listaTope = obtenerListadoDeConflictos(seccion, curso.sigla);
            const hasConflict = listaTope.length > 0;
            
            seccion.horario.forEach(bloque => {
                const slotStartTime = findSlotTime(bloque.inicio);
                if (!slotStartTime) return;

                const cell = scheduleTableBody.querySelector(
                    `td[data-day="${bloque.dia}"][data-slot-time="${slotStartTime}"]`
                );
                
                if (cell && !cell.classList.contains('lunch-break')) {
                    // Crear un div hijo para no alterar el display nativo del TD de la tabla
                    const previewDiv = document.createElement('div');
                    previewDiv.classList.add('course-block', 'preview-block');
                    previewDiv.style.backgroundColor = getCourseColor(curso.sigla);
                    
                    if (hasConflict) {
                        previewDiv.classList.add('preview-conflict');
                    }
                    
                    previewDiv.innerHTML = `
                        <span style="font-weight: bold;">${curso.sigla}-${seccion.id}</span>
                        <span>${bloque.tipo}</span>
                    `;
                    cell.appendChild(previewDiv);
                }
            });
        };
        
        if (!isAdded) {
            sectionContainer.addEventListener('mouseenter', previewSchedule);
            sectionContainer.addEventListener('mouseleave', removePreview);
        }
        
        // CORRECCIÓN 1: Cuadro de diálogo interactivo (Aceptar/Cancelar) antes de agregar si hay topes
        button.onclick = () => {
            removePreview(); 
            
            const listaTope = obtenerListadoDeConflictos(seccion, curso.sigla);
            if (listaTope.length > 0) {
                const mensajeAlerta = `¡ADVERTENCIA! La sección ${seccion.id} de ${curso.sigla} presenta topes horarios con:\n\n` + 
                                      listaTope.map(t => `• ${t}`).join('\n') + 
                                      `\n\n¿Estás seguro de que deseas agregar este curso de todas formas?`;
                
                const confirmarInscripcion = confirm(mensajeAlerta);
                if (!confirmarInscripcion) {
                    return; // Detiene la adición si el usuario presiona "Cancelar"
                }
            }
            
            const indexToRemove = horarioSeleccionado.findIndex(c => c.sigla === curso.sigla);
            if (indexToRemove !== -1) {
                removeCourse(horarioSeleccionado[indexToRemove].sigla, horarioSeleccionado[indexToRemove].seccionId); 
            }
            addCourseToSchedule(curso, seccion);
            
            courseSearchInput.value = '';
            searchCourses(); // Mantiene la lista limpia y actualizada por defecto
            sectionSelectionDiv.innerHTML = '';
        };
        
        sectionContainer.appendChild(button);
        sectionContainer.appendChild(summarySpan);
        scrollContainer.appendChild(sectionContainer);
    });

    sectionSelectionDiv.appendChild(scrollContainer);
}

function addCourseToSchedule(curso, seccion) {
    const courseData = {
        sigla: curso.sigla,
        nombre: curso.nombre,
        seccionId: seccion.id,
        horario: seccion.horario
    };

    horarioSeleccionado.push(courseData);
    renderSchedule(); 
    renderSelectedList();
}

function removeCourse(sigla, seccionId) {
    horarioSeleccionado = horarioSeleccionado.filter(c => 
        !(c.sigla === sigla && c.seccionId === seccionId)
    );
    renderSchedule(); 
    renderSelectedList();
}

// ==========================================================
// 6. RENDERIZADO Y BÚSQUEDA
// ==========================================================

function renderSchedule() {
    const allDayCells = scheduleTableBody.querySelectorAll('td:not(.time-label):not(.lunch-break)');
    allDayCells.forEach(cell => {
        cell.innerHTML = '';
    });

    horarioSeleccionado.forEach(curso => {
        curso.horario.forEach(bloque => {
            const fullBloque = { ...bloque, sigla: curso.sigla, seccionId: curso.seccionId };
            const hasConflict = checkConflict(fullBloque);

            const slotStartTime = findSlotTime(bloque.inicio);
            if (!slotStartTime) return;

            const cell = scheduleTableBody.querySelector(
                `td[data-day="${bloque.dia}"][data-slot-time="${slotStartTime}"]`
            );
            
            if (cell && !cell.classList.contains('lunch-break')) {
                const blockDiv = document.createElement('div');
                blockDiv.classList.add('course-block');
                
                if (hasConflict) {
                    blockDiv.classList.add('conflict');
                }
                
                blockDiv.style.backgroundColor = getCourseColor(curso.sigla);
                
                blockDiv.innerHTML = `
                    <span style="font-weight: bold;">${curso.sigla}-${curso.seccionId}</span>
                    <span>${bloque.tipo}</span>
                `;
                cell.appendChild(blockDiv);
            }
        });
    });
}

function renderSelectedList() {
    selectedCoursesList.innerHTML = '';
    
    if (horarioSeleccionado.length === 0) {
        selectedCoursesList.innerHTML = '<p style="color:#777; font-style:italic; padding:10px; margin:0;">No hay cursos seleccionados.</p>';
        return;
    }

    const table = document.createElement('table');
    table.classList.add('selected-table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Código</th>
                <th>Sec.</th>
                <th>Nombre del Curso</th>
                <th></th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    horarioSeleccionado.forEach(curso => {
        const tieneTope = curso.horario.some(bloque => 
            checkConflict({ ...bloque, sigla: curso.sigla, seccionId: curso.seccionId })
        );

        const tr = document.createElement('tr');
        if (tieneTope) {
            tr.classList.add('row-has-conflict'); 
        }

        tr.innerHTML = `
            <td>
                <span class="color-dot" style="background-color: ${getCourseColor(curso.sigla)}"></span>
                <strong>${curso.sigla}</strong>
            </td>
            <td>${curso.seccionId}</td>
            <td class="text-truncate" title="${curso.nombre}">${curso.nombre}</td>
            <td>
                <button class="action-remove-btn" data-sigla="${curso.sigla}" data-seccion="${curso.seccionId}">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    selectedCoursesList.appendChild(table);

    document.querySelectorAll('.action-remove-btn').forEach(button => {
        button.onclick = (e) => {
            const sigla = e.target.dataset.sigla;
            const seccionId = e.target.dataset.seccion;
            removeCourse(sigla, seccionId);
        };
    });
}

// CORRECCIÓN 2: Muestra la lista completa de cursos por defecto y la filtra dinámicamente
function searchCourses() {
    const query = limpiarTexto(courseSearchInput.value);
    courseResultsDiv.innerHTML = '';

    // Filtrado adaptativo (si está vacío, muestra la lista completa)
    const filtered = datosCursos.filter(curso => 
        limpiarTexto(curso.sigla).includes(query) || 
        limpiarTexto(curso.nombre).includes(query)
    );

    filtered.forEach(curso => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');
        resultItem.textContent = `${curso.sigla}: ${curso.nombre}`;
        resultItem.onclick = () => {
            displaySections(curso);
        };
        courseResultsDiv.appendChild(resultItem);
    });
}

// ==========================================================
// 7. ASIGNACIÓN DE COLORES DINÁMICOS
// ==========================================================

function getCourseColor(sigla) {
    const colors = {
        'INF101': '#4CAF50', 'MAT202': '#FF9800', 'INF303': '#2196F3', 
        'PEM101': '#673AB7', 'EHI036': '#00BCD4', 'INF305': '#FF5722',
        'OPM037': '#E91E63', 'PEM001': '#8BC34A', 'PEM002': '#FFC107', 
        'PEM102': '#03A9F4', 'PEM103': '#CDDC39', 'EHI018': '#9C27B0', 
        'EHI021': '#009688', 'EHI022': '#607D8B', 'EHI030': '#795548', 
        'EHI031': '#F44336', 'EHI035': '#4CAF50', 'EHI037': '#FF9800', 
        'EHI038': '#2196F3', 'EHI039': '#673AB7', 'INF301': '#FF5722', 
        'INF401': '#00BCD4', 'INF403': '#9E9E9E', 'INF405': '#607D8B', 
    };
    
    if (colors[sigla]) return colors[sigla];
    
    // Asignación de color pastel único basado en el hash del texto de la sigla
    let hash = 0;
    for (let i = 0; i < sigla.length; i++) {
        hash = sigla.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 45%)`;
}

function initApp() {
    generateScheduleGrid();
    searchCourses(); // Renderiza el listado completo al arrancar la app
    courseSearchInput.addEventListener('input', searchCourses);
}

initApp();
