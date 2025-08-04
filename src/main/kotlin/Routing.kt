import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.*

fun Application.configureRouting() {

    val passwordA = System.getProperty("pwa") ?: "default-secret"

    val passwordB = System.getProperty("pwb") ?: "default-secret"

    val teamPasswords = mapOf(
        "team-a" to passwordA,
        "team-b" to passwordB
    )

    routing {
        get("/") {
            call.respondText("Morse Code Simulator Server")
        }

        post("/auth/{team}") {
            val teamName = call.parameters["team"] ?: return@post call.respond(HttpStatusCode.BadRequest, "Team name required")
            val auth = call.receive<TeamAuth>()


            if (TeamManager.authenticateTeam(teamPasswords, teamName, auth.password)) {
                call.respond(HttpStatusCode.OK, mapOf("status" to "authenticated", "team" to teamName))
            } else {
                call.respond(HttpStatusCode.Unauthorized, mapOf("status" to "unauthorized"))
            }
        }

        // WebSocket endpoint for each team
        webSocket("/ws/{team}") {
            val teamName = call.parameters["team"] ?: return@webSocket close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Team name required"))
            val participantName = call.parameters["name"] ?: "Anonymous"

            val team = TeamManager.getOrCreateTeam(teamName)
            val participantId = UUID.randomUUID().toString()
            val participant = Participant(participantId, participantName, this)

            team.addParticipant(participant)

            try {
                // Send current state to new participant
                send(Frame.Text(Json.encodeToString(
                    SenderChange(sender = team.getCurrentSender())
                )))

                for (frame in incoming) {
                    when (frame) {
                        is Frame.Text -> {
                            val text = frame.readText()
                            try {
                                val json = Json.parseToJsonElement(text).jsonObject
                                val type = json["wstype"]?.jsonPrimitive?.content

                                when (type) {
                                    "morse_signal" -> {
                                        val signal = Json.decodeFromString<MorseSignal>(text)
                                        team.broadcastMorseSignal(signal, participantId)
                                    }
                                    "elect_sender" -> {
                                        val success = team.electSender(participantId)
                                        if (!success) {
                                            send(Frame.Text(Json.encodeToString(
                                                mapOf("type" to "error", "message" to "Someone else is already the sender")
                                            )))
                                        }
                                    }
                                    "release_sender" -> {
                                        team.releaseSender(participantId)
                                    }
                                }
                            } catch (e: Exception) {
                                send(Frame.Text(Json.encodeToString(
                                    mapOf("type" to "error", "message" to "Invalid message format")
                                )))
                            }
                        }
                        else -> {}
                    }
                }
            } catch (e: ClosedReceiveChannelException) {
            } catch (e: Throwable) {
                e.printStackTrace()
            } finally {
                team.removeParticipant(participantId)
            }
        }
    }
}