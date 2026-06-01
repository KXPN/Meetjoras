'use strict';

window.onerror = null;

class Meetjoras {

  opciones = {};

  selectorPorNombre = {
    chatIcono: '[data-panel-id="2"]',
    imagenes: (
      '[data-priority][data-side] [tabindex][role=region] img[src^="https://"][data-iml][alt=""]:not([jsname],[jscontroller],[aria-hidden])'
    ),
    listaParticipante: (
      '[data-panel-container-id=sidePanel1] [data-participant-id]'
    ),
    listaParticipanteNombre: (
      '[data-panel-container-id=sidePanel1] [data-participant-id] span'
    ),
    notificacion: '[data-key^="notification-"]',
    mensajes: '[data-message-id]',
    participante: '[data-participant-id][data-tile-media-id]',
    participantesListaIcono: '[data-panel-id][data-promo-anchor-id] i',
    participantesSinCamaraGrupoPrimerIntegrante: (
      '[jsname][draggable=false]:not([data-emoji],[title])'
    ),
    reunionBotonFinalizarIcono: '.VYBDae-Bz112c-LgbsSe.VYBDae-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc.hk9qKe.Iootmd.vLQezd',
    reunionNombre: '.EY8ABd-OWXEXe-TAWMXe',
    subtituloEstaPrendido: (
      '[data-is-auto-rejoin] [role=region] [role=button][data-tooltip-id][data-idom-class]:not([aria-expanded],[data-emoji],[data-promo-anchor-id],[disabled]) span[aria-hidden]'
    ),
    subtituloEstaPrendidoIcono: (
      '[data-is-auto-rejoin] [role=region] [role=button][data-tooltip-id][data-idom-class]:not([aria-expanded],[data-emoji],[data-promo-anchor-id],[disabled]) span[aria-hidden] i'
    ),
  };

  transcripcion;

  constructor({ opciones }) {
    this.opciones = {opciones};
    this.opciones.selectorPorNombre = this.selectorPorNombre;
    this.inicializar();
  }

  inicializar = () => {
    const dParticipantesListaIcono = (
      document.querySelector(this.selectorPorNombre.participantesListaIcono)
    );
    if (!dParticipantesListaIcono) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    const dParticipantesListaIconoDatos = dParticipantesListaIcono.dataset;
    if (!dParticipantesListaIconoDatos.clicHecho) {
      dParticipantesListaIcono.click();
      dParticipantesListaIconoDatos.clicHecho = true;
    }
    const dListaParticipante = (
      document.querySelector(this.selectorPorNombre.listaParticipante)
    );
    if (!dListaParticipante) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    dParticipantesListaIcono.click();
    this.transcripcion = new Transcripcion(this.opciones);
    this.transcripcion = new GrillaParticipantesSinCamara(this.opciones);
  }

}

class Transcripcion {

  // Configuraciones
  // Tu nombre, para mostrar cuando hablas tú, es:
  nombre = '';
  // Sufijo del archivo generado
  sufijo = '';
  // Atajos para iniciar o detener la transcripción
  // Opciones: Alt, Ctrl, Shift, Tecla [Obligatoria]
  // Ejemplo: Ctrl+Shift+Q
  atajosPorAccion = {
    iniciar: 'Ctrl+Shift+Q',
    detener: 'Ctrl+Alt+Q',
  };
  // Transparencia de los subtítulos, debe ser un número natural en el rango
  // [0, 100]
  subtitulosTransparencia = 50;
  // Códigos de reuniones que se deben ignorar, separados por coma
  reunionesCodigosAIgnorar = '';

  // Estos valores tal vez se deben cambiar si Google cambia la interfaz
  botonActivoColor = 'rgb(138, 180, 248)';
  selectorPorNombre = {};

  // De aquí para abajo no se debe configurar más
  archivoDescargado = false;
  dBotonCapturar;
  subtitulosIntervalo;
  mensajesIntervalo;
  intervencionesFragmentosPorHoraYPersona = {};
  participantesNombres = [];
  reunion = {
    codigo: '',
    fechaYHora: '',
    nombre: '',
  };
  ultimaHora = '';
  ultimaPersonaNombre = '';
  personaMensajeSufijo = ' (Chat)';

  constructor(opciones) {
    if (opciones !== undefined) {
      this.selectorPorNombre = opciones.selectorPorNombre;
      this.nombre = (opciones.transcripcion?.nombre || this.nombre);
      this.sufijo = (opciones.transcripcion?.sufijo || this.sufijo);
      this.atajosPorAccion.iniciar = (
        opciones.transcripcion?.atajosPorAccion.iniciar ||
        this.atajosPorAccion.iniciar
      );
      this.atajosPorAccion.finalizar = (
        opciones.transcripcion?.atajosPorAccion.finalizar ||
        this.atajosPorAccion.finalizar
      );
      this.subtitulosTransparencia = (
        opciones.transcripcion?.subtitulosTransparencia ||
        this.subtitulosTransparencia
      );
      this.reunionesCodigosAIgnorar = (
        opciones.transcripcion?.reunionesCodigosAIgnorar ||
        this.reunionesCodigosAIgnorar
      );
    }
    const reunionCodigo = (
      document
      .location
      .pathname
      .match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
      [0]
    );
    if (this.reunionesCodigosAIgnorar.split(',').includes(reunionCodigo)) {
      return;
    }
    this.reunion.codigo = reunionCodigo;
    this.insertarBotonInicio();
  }

  insertarBotonInicio = () => {
    let dReunionNombre = document.querySelector(this.selectorPorNombre.reunionNombre);
    if (!dReunionNombre) {
      setTimeout(this.insertarBotonInicio);
      return;
    }
    const dBotonCapturar = document.createElement('button');
    dBotonCapturar.innerText = 'Capturar transcripción';
    const botonInicioEstilos = dBotonCapturar.style;
    botonInicioEstilos.background = 'green';
    botonInicioEstilos.cursor = 'pointer';
    dBotonCapturar.addEventListener('click', this.capturar);
    dReunionNombre.parentElement.parentElement.appendChild(dBotonCapturar);
    document.body.addEventListener('keydown', this.revisarAtajos);
    this.dBotonCapturar = dBotonCapturar;
  }

  revisarAtajos = (evento) => {
    for (let accion in this.atajosPorAccion) {
      const atajoTeclas = (
        this
        .atajosPorAccion
        [accion]
        .toLowerCase()
        .split(/\+/)
      );
      const teclasPresionadasPorTecla = {};
      if (evento.altKey) {
        teclasPresionadasPorTecla.alt = true;
      }
      if (evento.ctrlKey) {
        teclasPresionadasPorTecla.ctrl = true;
      }
      if (evento.shiftKey) {
        teclasPresionadasPorTecla.shift = true;
      }
      const tecla = evento.key.toLowerCase();
      if (teclasPresionadasPorTecla[tecla]) {
        continue;
      }
      teclasPresionadasPorTecla[tecla] = true;
      let atajoTeclasFueronPresionadas = true;
      for (let atajoTecla of atajoTeclas) {
        if (!teclasPresionadasPorTecla[atajoTecla]) {
          atajoTeclasFueronPresionadas = false;
          break;
        }
      }
      if (
        !atajoTeclasFueronPresionadas ||
        (atajoTeclas.length !== Object.keys(teclasPresionadasPorTecla).length)
      ) {
        continue;
      }
      if (accion === 'iniciar') {
        this.capturar();
      } else if (accion === 'detener') {
        this.detener();
      }
      return;
    }
  }

  detener = () => {
    this.cambiarSubtitulosBotonEstado(false);
  }

  cambiarSubtitulosBotonEstado = (debeEstarActivo) => {
    let dSubtituloEstaPrendido = (
      document.querySelector(this.selectorPorNombre.subtituloEstaPrendidoIcono)
    );
    let dSubtitulosBoton = dSubtituloEstaPrendido?.parentElement?.parentElement;
    if (!dSubtitulosBoton) {
      const dSubtituloEstaPrendidoIcono = (
        document.querySelector(this.selectorPorNombre.subtituloEstaPrendido)
      );
      dSubtitulosBoton = dSubtituloEstaPrendidoIcono.parentElement;
    }
    const subtitulosBotonFondoColor = (
      getComputedStyle(dSubtitulosBoton)
      .backgroundColor
    );
    const subtitulosBotonEstaActivo = (
      subtitulosBotonFondoColor ===
      this.botonActivoColor
    );
    if (
      (!subtitulosBotonEstaActivo && debeEstarActivo) ||
      (subtitulosBotonEstaActivo && !debeEstarActivo)
    ) {
      dSubtitulosBoton.click();
    }
  }

  capturar = () => {
    this.cambiarSubtitulosBotonEstado(true);
    if (this.reunion.fechaYHora) {
      return;
    }
    this.dBotonCapturar.remove();
    window.addEventListener('beforeunload', this.descargarArchivo);
    this.reunion.fechaYHora = this.obtenerFechaYHoraActualSinPuntuacion();
    const dListaParticipantes = (
      document.querySelectorAll(this.selectorPorNombre.listaParticipante)
    );
    dListaParticipantes.forEach(this.agregarParticipante);
    const reunionNombre = (
      document.querySelector(this.selectorPorNombre.reunionNombre).innerText
    );
    const reunionCodigo = this.reunion.codigo;
    if (reunionCodigo === reunionNombre) {
      reunionNombre = '';
    }
    const inicioMensaje = (
      'En ' +
      this.obtenerFechaActualSinPuntuacion() +
      ' ' +
      'inicia la transcripción de la reunión' +
      (reunionNombre ? (' "' + reunionNombre + '"') : '') +
      ' ' +
      'con código ' +
      '"' + reunionCodigo + '" ' +
      'con ' +
      this.participantesNombres.join(', ')
    );
    this.guardarSistemaIntervencion(inicioMensaje);
    this.reunion.nombre = reunionNombre;
    const dBotonColgar = (
      document.querySelector(this.selectorPorNombre.reunionBotonFinalizarIcono)
    );
    dBotonColgar.addEventListener('click', this.descargarArchivo);
    this.subtitulosIntervalo = setInterval(this.actualizar);
    this.mensajesIntervalo = setInterval(this.capturarMensajes);
  }

  actualizar = () => {
    const dImagenes = document.querySelectorAll(this.selectorPorNombre.imagenes);
    dImagenes.forEach(this.actualizarIntervenciones);
  }

  actualizarIntervenciones = (dIntervencionImagen) => {
    if (!dIntervencionImagen.offsetHeight) {
      return;
    }
    dIntervencionImagen.parentElement.parentElement.style.opacity = (
      1 -
      (this.subtitulosTransparencia / 100)
    );
    let interaccionHora = dIntervencionImagen.hora;
    if (!interaccionHora) {
      interaccionHora = this.obtenerHoraActualConDosPuntos();
      dIntervencionImagen.hora = interaccionHora;
    }
    this.ultimaHora = interaccionHora;
    const dPersonaNombre = dIntervencionImagen.nextElementSibling;
    if (!dPersonaNombre) {
      return;
    }
    let ultimaPersonaNombre = dPersonaNombre.innerText.trim();
    ultimaPersonaNombre = this.reemplazarPronombre(ultimaPersonaNombre);
    this.ultimaPersonaNombre = ultimaPersonaNombre;
    const dIntervencionFragmentos = (
      dPersonaNombre
      .parentElement
      .parentElement
      .querySelectorAll('div:not(:has(div),:has(span))')
    );
    dIntervencionFragmentos.forEach(this.guardarIntervencionFragmento);
  }

  reemplazarPronombre = (personaNombre) => {
    if (!this.nombre) {
      return personaNombre;
    }
    return (
      personaNombre
      .replace(
        (
          document
          .querySelector(this.selectorPorNombre.listaParticipanteNombre)
          .innerText
        ),
        this.nombre,
      )
    );
  }

  obtenerFechaYHoraActualSinPuntuacion = () => {
    const fechaSinPuntuacion = this.obtenerFechaActualSinPuntuacion();
    const horaActualSinPuntuacion = (
      this
      .obtenerHoraActualConDosPuntos()
      .replace(/:/g, '')
    );
    return (fechaSinPuntuacion + ' ' + horaActualSinPuntuacion);
  }

  obtenerFechaActualSinPuntuacion = () => {
    const fechaYHora = new Date();
    const ano = fechaYHora.getFullYear();
    const mes = this.ajustarADosDigitos(fechaYHora.getMonth() + 1);
    const dia = this.ajustarADosDigitos(fechaYHora.getDate());
    return (ano + mes + dia);
  }

  obtenerHoraActualConDosPuntos = () => {
    const fechaYHora = new Date();
    const horas = this.ajustarADosDigitos(fechaYHora.getHours());
    const minutos = this.ajustarADosDigitos(fechaYHora.getMinutes());
    const segundos = this.ajustarADosDigitos(fechaYHora.getSeconds());
    return (horas + ':' + minutos + ':' + segundos);
  }

  ajustarADosDigitos = (numero) => {
    return ('0' + numero).slice(-2);
  }

  marcarMensajesComoAgregados = () => {
    (
      document
      .querySelectorAll(this.selectorPorNombre.mensajes)
      .forEach((dMensaje) => {dMensaje.agregado = true})
    );
  }

  capturarMensajes = () => {
    let dChatIcono = document.querySelector(this.selectorPorNombre.chatIcono);
    if (dChatIcono.ariaExpanded) {
      dChatIcono.click();
      dChatIcono.click();
    }
    (
      document
      .querySelectorAll(this.selectorPorNombre.mensajes)
      .forEach(this.guardarIntervencionMensaje)
    );
  }

  guardarIntervencionMensaje = (dMensaje) => {
    if (dMensaje.agregado) {
      return;
    }
    dMensaje.agregado = true;
    this.ultimaHora = this.obtenerHoraActualConDosPuntos();
    this.ultimaPersonaNombre = (
      (
        (
          dMensaje.parentElement.parentElement.parentElement.firstChild.nodeName
          ===
          'IMG'
        ) ?
        dMensaje.parentElement.parentElement.innerText.split('\n')[0] :
        this.nombre
      ) +
      this.personaMensajeSufijo
    );
    this.guardarIntervencion(dMensaje.innerText);
  }

  guardarIntervencionNotificacion = (dNotificacion) => {
    if (dNotificacion.agregada) {
      return;
    }
    dNotificacion.agregada = true;
    const notificacionPartes = dNotificacion.innerText.split('\n');
    const notificacionTipo = notificacionPartes[0];
    if (notificacionTipo === 'domain_disabled') {
      return;
    }
    if (notificacionTipo !== 'chat') {
      this.guardarSistemaIntervencion(notificacionPartes[0]);
      return;
    }
    this.ultimaPersonaNombre = (
      notificacionPartes[1] +
      this.personaMensajeSufijo
    );
    this.guardarIntervencion(notificacionPartes.splice(2).join('\n'));
  }

  guardarIntervencionFragmento = (dIntervencionFragmento) => {
    const fragmentoNuevo = dIntervencionFragmento.innerText;
    let fragmentoId = dIntervencionFragmento.id;
    if (!fragmentoId) {
      fragmentoId = new Date().getTime();
      dIntervencionFragmento.id = fragmentoId;
    }

    this.guardarIntervencion(fragmentoNuevo, fragmentoId);
  }

  guardarIntervencion = (fragmentoNuevo, fragmentoId = '') => {
    const horaYPersona = (this.ultimaHora + ' ' + this.ultimaPersonaNombre);
    if (!fragmentoId) {
      fragmentoId = new Date().getTime();
    }
    if (!this.intervencionesFragmentosPorHoraYPersona[horaYPersona]) {
      this.intervencionesFragmentosPorHoraYPersona[horaYPersona] = {};
    }
    this.intervencionesFragmentosPorHoraYPersona[horaYPersona][fragmentoId] = (
      fragmentoNuevo
    );
  }

  guardarSistemaIntervencion = (fragmentoNuevo) => {
    this.ultimaHora = this.obtenerHoraActualConDosPuntos();
    this.ultimaPersonaNombre = 'Sistema';
    this.guardarIntervencion(fragmentoNuevo);
  }

  agregarParticipante = (dListaParticipante) => {
    const nombre = dListaParticipante.querySelector('span').textContent.trim();
    this.participantesNombres.push(nombre);
  }

  descargarArchivo = () => {
    if (this.archivoDescargado) {
      return;
    }
    let archivoContenido = '';
    for (let horaYPersona in this.intervencionesFragmentosPorHoraYPersona) {
      archivoContenido += (horaYPersona + ': ');
      const intervencionFragmentos = (
        this
        .intervencionesFragmentosPorHoraYPersona
        [horaYPersona]
      );
      for (const fragmentoId in intervencionFragmentos) {
        const intervencionFragmento = intervencionFragmentos[fragmentoId];
        archivoContenido += (intervencionFragmento + ' ');
      }
      archivoContenido = (archivoContenido.trim() + '\n\n');
    }
    if (!archivoContenido) {
      return;
    }
    archivoContenido = archivoContenido.replace(/ +/, ' ');
    const dDescargaEnlace = document.createElement('a');
    const archivoObjeto = new Blob([archivoContenido], {type: 'text/plain'})
    dDescargaEnlace.href = window.URL.createObjectURL(archivoObjeto);
    dDescargaEnlace.download = (
      this.reunion.fechaYHora +
      (
        this.reunion.nombre ?
        (' ' + this.reunion.nombre) :
        ''
      ) +
      this.sufijo +
      '.txt'
    );
    dDescargaEnlace.click();
    this.archivoDescargado = true;
  }

}

class GrillaParticipantesSinCamara {

  selectoresPorNombre = {};

  participantes = [];
  participantesPorNombre = {};
  participantesConCamaraPorNombre = {};
  participantesSinCamaraGrupoTexto = '';
  participantesSinCamaraGrupoAnchura = '';

  constructor() {
    this.inicializar();
  }

  inicializar = () => {
    const dParticipantesListaIcono = (
      document.querySelector(this.selectoresPorNombre.participantesListaIcono)
    );
    if (!dParticipantesListaIcono) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    dParticipantesListaIcono.click();
    const dListaParticipante = (
      document.querySelector(this.selectoresPorNombre.listaParticipante)
    );
    if (!dListaParticipante) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    dParticipantesListaIcono.click();
    this.intervalo = setInterval(this.revisarCambios.bind(this));
  }

  revisarCambios = () => {
    // Oculta ventana de micrófono silenciado por el sistema
    document.querySelector('[data-is-persistent]')?.remove();
    const dParticipantesSinCamaraGrupoPrimerIntegrante = (
      document
      .querySelector(
        this.selectoresPorNombre.participantesSinCamaraGrupoPrimerIntegrante
      )
    );
    if (
      !dParticipantesSinCamaraGrupoPrimerIntegrante ||
      (
        dParticipantesSinCamaraGrupoPrimerIntegrante
        .closest('[data-participant-id]')
      ) ||
      (
        dParticipantesSinCamaraGrupoPrimerIntegrante
        .closest('[data-priority]')
      )
    ) {
      return;
    }
    const dParticipantesSinCamaraGrupo = (
      dParticipantesSinCamaraGrupoPrimerIntegrante.closest('[style]')
    );
    if (!dParticipantesSinCamaraGrupo) {
      return;
    }
    const participantesSinCamaraGrupoTexto = (
      dParticipantesSinCamaraGrupo.firstChild.innerText.trim()
    );
    const participantesSinCamaraGrupoDimension = (
      dParticipantesSinCamaraGrupo.offsetWidth +
      'x' +
      dParticipantesSinCamaraGrupo.offsetHeight
    );
    let ejecucionEsPrimera = !document.querySelector('.jsGrilla');
    if (!this.participantesSinCamaraGrupoTexto) {
      ejecucionEsPrimera = true;
      this.participantesSinCamaraGrupoTexto = participantesSinCamaraGrupoTexto;
      this.participantesSinCamaraGrupoDimension = (
        participantesSinCamaraGrupoDimension
      );
    }
    let participantesSinCamaraCantidadCambio = (
      this.participantesSinCamaraGrupoTexto !==
      participantesSinCamaraGrupoTexto
    );
    let participantesSinCamaraGrupoDimensionCambio = (
      this.participantesSinCamaraGrupoDimension !==
      participantesSinCamaraGrupoDimension
    );
    const dNotificacion = (
      document.querySelector(this.selectoresPorNombre.notificacion)
    );
    let hayNotificacion = (dNotificacion && !dNotificacion.dataset.fueVista);
    if (hayNotificacion) {
      dNotificacion.dataset.fueVista = true;
    }
    if (
      !ejecucionEsPrimera &&
      !participantesSinCamaraCantidadCambio &&
      !participantesSinCamaraGrupoDimensionCambio &&
      !hayNotificacion
    ) {
      return;
    }
    this.participantesSinCamaraGrupoTexto = participantesSinCamaraGrupoTexto;
    this.participantesSinCamaraGrupoDimension = (
      participantesSinCamaraGrupoDimension
    );
    this.grillarParticipantes(dParticipantesSinCamaraGrupo);
  }

  grillarParticipantes = (dParticipantesSinCamaraGrupo) => {
    this.participantesConCamaraPorNombre = {};
    const dParticipantes = (
      document.querySelectorAll(this.selectoresPorNombre.participante)
    );
    dParticipantes.forEach(this.agregarParticipanteConCamara);
    this.participantes = [];
    this.participantesPorNombre = {};
    const dListaParticipantes = (
      document.querySelectorAll(this.selectoresPorNombre.listaParticipante)
    );
    dListaParticipantes.forEach(this.agregarParticipante);
    if (!this.participantes.length) {
      return;
    }
    let dGrilla = document.querySelector('.jsGrilla');
    if (dGrilla) {
      dGrilla.remove();
    }
    dGrilla = document.createElement('div');
    dGrilla.classList.add('jsGrilla');
    dGrilla.style.position = 'absolute';
    dGrilla.style.width = '100%';
    dGrilla.style.height = '100%';
    dGrilla.style.backgroundColor = '#3c4043';
    dGrilla.style.top = 0;
    dGrilla.style.left = 0;
    const participantesGrupoAnchura = dParticipantesSinCamaraGrupo.offsetWidth;
    const participantesGrupoAltura = dParticipantesSinCamaraGrupo.offsetHeight;
    let anchura = participantesGrupoAnchura;
    let altura = participantesGrupoAltura;
    let anchuraDivisor = 2;
    let alturaDivisor = 1;
    while (
      (participantesGrupoAnchura / anchura) *
      (participantesGrupoAltura / altura) <
      this.participantes.length
    ) {
      anchura = participantesGrupoAnchura / anchuraDivisor;
      altura = participantesGrupoAltura / alturaDivisor;
      if (anchuraDivisor === alturaDivisor) {
        anchuraDivisor++;
      } else {
        alturaDivisor++;
      }
    }
    for (const participante of this.participantes) {
      const dParticipante = document.createElement('div');
      dParticipante.classList.add('jsParticipanteLampara');
      dParticipante.style.display = 'inline-block';
      dParticipante.style.height = (altura + 'px');
      dParticipante.style.position = 'relative';
      dParticipante.style.width = (anchura + 'px');

      const dParticipanteImagen = participante.dImagen.cloneNode(true);
      dParticipanteImagen.className = '';
      dParticipanteImagen.classList.add('jsParticipanteLamparaImagen');
      dParticipanteImagen.style.float = 'left';
      dParticipanteImagen.style.height = 'initial';
      dParticipanteImagen.style.width = ((anchura / 2) + 'px');
      dParticipante.appendChild(dParticipanteImagen);

      const dParticipanteAudio = participante.dAudio.cloneNode(true);
      dParticipanteAudio.className = '';
      dParticipanteAudio.classList.add('jsParticipanteLamparaAudio');
      dParticipanteAudio.style.transform = 'scale(0.5)';
      dParticipante.appendChild(dParticipanteAudio);

      const dParticipanteNombre = document.createElement('span');
      dParticipanteNombre.classList.add('jsParticipanteLamparaNombre');
      dParticipanteNombre.textContent = participante.nombre;
      dParticipanteNombre.style.background = 'rgba(0, 0, 0, .8)';
      dParticipanteNombre.style.color = 'white';
      dParticipanteNombre.style.left = '0';
      dParticipanteNombre.style.position = 'absolute';
      dParticipanteNombre.style.top = '0';
      dParticipante.appendChild(dParticipanteNombre);

      dGrilla.appendChild(dParticipante);
    }
    dParticipantesSinCamaraGrupo.appendChild(dGrilla);
  }

  agregarParticipanteConCamara = (dParticipante) => {
    const dParticipanteNombre = (
      dParticipante.innerText.split('\n').pop().trim()
    );
    if (!dParticipanteNombre) {
      return;
    }
    const dParticipanteVideo = dParticipante.querySelector('video');
    if (!dParticipanteVideo) {
      return;
    }
    this.participantesConCamaraPorNombre[dParticipanteNombre] = true;
  }

  agregarParticipante = (dListaParticipante) => {
    const nombre = dListaParticipante.querySelector('span').textContent.trim();
    if (this.participantesConCamaraPorNombre[nombre]) {
      return;
    }
    if (this.participantesPorNombre[nombre]) {
      return;
    }
    this.participantesPorNombre[nombre] = true;
    const participante = {
      nombre,
      dImagen: dListaParticipante.querySelector('img'),
      dAudio: dListaParticipante.querySelector('[data-tooltip-enabled]'),
    };
    this.participantes.push(participante);
  }

}


if (typeof browser === 'undefined') {
  var browser = chrome;
}
if (browser.storage) {
  browser.storage.sync.get('opciones', iniciarMeetjoras);
} else {
  iniciarMeetjoras({});
}

function iniciarMeetjoras(opciones) {
  window.meetjoras = new Meetjoras(opciones);
}
