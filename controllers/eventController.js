// Importamos el modelo Task para interactuar con la base de datos
const Event = require("../models/events");
const admin = require("../config/config");
const db = admin.firestore();
const collection = db.collection("Eventos");

class eventController {
  // Método para obtener todas los eventos
  static async getEvents(req, res) {
    try {
      // Obtener todos los documentos de la colección "Eventos" en Firestore
      const snapshot = await collection.get();
      
      // Mapeamos los documentos y convertimos las fechas a formato legible
      const events = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,  // ID del documento en Firestore
          ...data,      // Campos del evento
          fechaInicio: data.fechaInicio.toDate ? data.fechaInicio.toDate().toISOString() : null,
          fechaFin: data.fechaFin?.toDate ? data.fechaFin.toDate().toISOString() : null
        };
      });
  
      // Respondemos con la lista de eventos convertidos
      res.json(events);
    } catch (error) {
      // En caso de error, respondemos con el error detallado
      res.status(500).json({ error: error.message });
    }
  }

  // Método para obtener un evento específico por su ID
  static async getEventById(req, res) {
    try {
      // Obtener el documento del evento con el ID proporcionado
      const eventDoc = await collection.doc(req.params.id).get();
      
      // Si el evento no existe, respondemos con un error 404
      if (!eventDoc.exists) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
  
      // Extraemos los datos del evento
      const data = eventDoc.data();
      const event = {
        id: eventDoc.id,  // ID del documento en Firestore
        ...data,           // Campos del evento
        fechaInicio: data.fechaInicio.toDate ? data.fechaInicio.toDate().toISOString() : null,
        fechaFin: data.fechaFin?.toDate ? data.fechaFin.toDate().toISOString() : null
      };
  
      // Respondemos con los datos del evento solicitado
      res.json(event);
    } catch (error) {
      // En caso de error, respondemos con el error detallado
      res.status(500).json({ error: error.message });
    }
  }  

  // Método para crear un nuevo evento
  // Controlador para crear un nuevo evento
  static async createEvent(req, res) {
    try {
      let eventData = req.body;  // Datos del evento enviados en el cuerpo de la solicitud
  
      // Validación para asegurarnos de que se incluyan los campos obligatorios
      if (!eventData.titulo || !eventData.fechaInicio) {
        return res.status(400).json({ message: "Faltan datos requeridos" });
      }
  
      // Convertir la fecha de inicio a formato Timestamp de Firestore
      eventData.fechaInicio = new admin.firestore.Timestamp(
        Math.floor(new Date(eventData.fechaInicio).getTime() / 1000),
        0
      );
  
      // Si se incluye fecha de fin, convertirla también a Timestamp
      if (eventData.fechaFin) {
        eventData.fechaFin = new admin.firestore.Timestamp(
          Math.floor(new Date(eventData.fechaFin).getTime() / 1000),
          0
        );
      }
  
      // Llamada al modelo para crear el evento en la base de datos
      const createdEvent = await Event.createEvent(eventData);
  
      // Respondemos con el evento recién creado
      res.status(201).json(createdEvent);
    } catch (error) {
      // En caso de error, respondemos con el mensaje de error correspondiente
      console.error("Error al crear el evento:", error);
      res.status(500).json({ message: "Error al crear el evento", error: error.message });
    }
  }

  // Método para actualizar un evento existente
  static async updateEvent(req, res) {
    const eventData = req.body;  // Datos enviados en el cuerpo de la solicitud
  
    // Validación de capacidad máxima y lugares disponibles
    if (eventData.capacidadMaxima <= eventData.lugaresDisponibles) {
      return res.status(400).json({
        message: "Los lugares disponibles no pueden ser mayores que la capacidad máxima",
      });
    }
  
    // Verifica si el número de participantes excede la capacidad máxima
    if (
      eventData.participantes &&
      eventData.participantes.length > eventData.capacidadMaxima
    ) {
      return res.status(400).json({
        message: `El número de participantes excede la capacidad máxima de ${eventData.capacidadMaxima}`,
      });
    }
  
    // Función para convertir fechas a Timestamp
    const convertToTimestamp = (date) => {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return null; // Devuelve null si la fecha no es válida
      }
      return new admin.firestore.Timestamp(
        Math.floor(parsedDate.getTime() / 1000),
        0
      );
    };
  
    // Convertimos fechaInicio a Timestamp si se proporciona y es válida
    if (eventData.fechaInicio) {
      const fechaInicioTimestamp = convertToTimestamp(eventData.fechaInicio);
      if (!fechaInicioTimestamp) {
        return res.status(400).json({ message: "Fecha de inicio no válida" });
      }
      eventData.fechaInicio = fechaInicioTimestamp;
    }
  
    // Convertimos fechaFin a Timestamp si se proporciona y es válida
    if (eventData.fechaFin) {
      const fechaFinTimestamp = convertToTimestamp(eventData.fechaFin);
      if (!fechaFinTimestamp) {
        return res.status(400).json({ message: "Fecha de fin no válida" });
      }
      eventData.fechaFin = fechaFinTimestamp;
    }
  
    try {
      // Llama al modelo para actualizar el evento por ID
      await Event.updateEvent(req.params.id, eventData);
  
      // Responde con un mensaje de éxito
      res.json({ message: "Evento actualizado correctamente" });
    } catch (error) {
      console.error(`Error al actualizar el evento: ${error}`);
      res.status(500).json({ error: "Error al actualizar el evento", message: error.message });
    }
  }  

  // Método para eliminar un evento
  static async deleteEvent(req, res) {
    try {
      await Event.deleteEvent(req.params.id); // Llama al modelo para eliminar el evento por ID
      res.json({ message: "Evento eliminado correctamente" }); // Mensaje de éxito
    } catch (error) {
      res.status(500).json({ error: error.message }); // Manejo de errores internos del servidor
    }
  }

  static async enviarRecordatorio(req, res) {
    try {
      // Obtiene el ID del evento desde los parámetros de la URL
      const eventId = req.params.id;
      console.log(`Buscando evento con ID: ${eventId}`);
  
      // Obtiene el documento del evento desde Firestore usando el ID proporcionado
      const eventDoc = await collection.doc(eventId).get();
      
      // Si no se encuentra el evento, devuelve un error 404
      if (!eventDoc.exists) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
  
      // Obtiene los datos del evento desde el documento de Firestore
      const eventData = eventDoc.data();
      
      // Convierte la fecha de inicio del evento de Firestore (Timestamp) a un objeto Date
      const fechaEvento = eventData.fechaInicio.toDate ? eventData.fechaInicio.toDate() : null;
      const fechaActual = new Date();
  
      // Verifica si la fecha del evento es válida
      if (fechaEvento) {
        // Calcula la diferencia en días entre la fecha actual y la fecha del evento
        const diferenciaDias = Math.floor((fechaEvento - fechaActual) / (1000 * 60 * 60 * 24));
  
        // Si faltan más de 5 días para el evento, no se envían recordatorios
        if (diferenciaDias >= 5) {
          return res.status(400).json({
            message:
              "Fecha no óptima para enviar las notificaciones. El evento es dentro de más de 5 días.",
          });
        }
  
        // Verifica si el evento tiene participantes. Si no, no se envían recordatorios.
        if (!eventData.participantes || eventData.participantes.length === 0) {
          return res.json({
            message: "No hay participantes para enviar recordatorios",
          });
        }
  
        // Crea un arreglo con los correos de los participantes y los mensajes personalizados
        const recordatorios = eventData.participantes.map((participante) => ({
          correo: participante.correo,
          mensaje: `Enviando recordatorio a ${participante.correo}: "${
            eventData.titulo
          }" será el ${fechaEvento.toLocaleString()}`,
        }));
  
        // Devuelve una respuesta JSON con el mensaje de éxito y los participantes
        return res.json({
          message: "Recordatorio enviado",
          evento: {
            participantes: recordatorios, // Los correos y mensajes de los participantes
          },
        });
      } else {
        // Si la fecha del evento no es válida, responde con un error 400
        return res.status(400).json({ message: "Fecha de evento no válida" });
      }
    } catch (error) {
      // En caso de error, loguea el error y responde con un error 500
      console.error(`Error al enviar recordatorio: ${error}`);
      return res.status(500).json({
        message: "Error al enviar recordatorio",
        error: error.message,
      });
    }
  }
}

// Exportamos la clase para que pueda ser utilizada en las rutas
module.exports = eventController;
