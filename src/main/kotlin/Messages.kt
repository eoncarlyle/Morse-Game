import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed class WebSocketMessage

@Serializable
data class MorseSignal(
    val wstype: String = "morse_signal",
    val signal: String,
    val duration: Long? = null
) : WebSocketMessage()

@Serializable
data class SenderChange(
    val wstype: String = "sender_change",
    val sender: String?
) : WebSocketMessage()

@Serializable
data class ParticipantsUpdate(
    val wstype: String = "participants_update",
    val participants: List<String>
) : WebSocketMessage()

@Serializable
data class ErrorMessage(
    val wstype: String = "error",
    val message: String
) : WebSocketMessage()

@Serializable
data class TeamAuth(
    val team: String,
    val password: String
)