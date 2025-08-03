import io.ktor.websocket.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

data class Participant(
    val id: String,
    val name: String,
    val session: DefaultWebSocketSession
)

val wsJson = Json {
    classDiscriminator = "class_type"
}

class Team(val name: String) {
    private val participants = ConcurrentHashMap<String, Participant>()
    private val currentSender = AtomicReference<String?>(null)

    suspend fun addParticipant(participant: Participant) {
        participants[participant.id] = participant
        broadcastParticipantsUpdate()
    }

    suspend fun removeParticipant(participantId: String) {
        participants.remove(participantId)
        if (currentSender.get() == participantId) {
            currentSender.set(null)
            broadcastSenderChange(null)
        }
        broadcastParticipantsUpdate()
    }

    suspend fun electSender(participantId: String): Boolean {
        //return if (currentSender.compareAndSet(null, participantId)) {
            val participant = participants[participantId]
            broadcastSenderChange(participant?.name)
            return true
        //} else {
        //    false
        //}
    }

    suspend fun releaseSender(participantId: String): Boolean {
        //return if (currentSender.compareAndSet(participantId, null)) {
            broadcastSenderChange(null)
            return true
        //} else {
        //    false
        //}
    }

    fun getCurrentSender(): String? = currentSender.get()

    suspend fun broadcastMorseSignal(signal: MorseSignal, senderId: String) {
        //if (currentSender.get() == senderId) {
            broadcast(signal)
        //}
    }

    private suspend fun broadcastSenderChange(senderName: String?) {
        broadcast(SenderChange(sender = senderName))
    }

    private suspend fun broadcastParticipantsUpdate() {
        val participantNames = participants.values.map { it.name }
        broadcast(ParticipantsUpdate(participants = participantNames))
    }

    private suspend fun broadcast(message: WebSocketMessage) {
        val json = wsJson.encodeToString(message)
        participants.values.forEach { participant ->
            try {
                participant.session.send(Frame.Text(json))
            } catch (e: Exception) {
                removeParticipant(participant.id)
            }
        }
    }
}