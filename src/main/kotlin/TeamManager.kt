import java.util.concurrent.ConcurrentHashMap

object TeamManager {
    private val teams = ConcurrentHashMap<String, Team>()

    // Simple password hashing - for production, use bcrypt or similar
    //private val teamPasswords = mapOf(
    //    "team-a" to hashPassword("summer2024a"),
    //    "team-b" to hashPassword("summer2024b")
    //)

    //private fun hashPassword(password: String): String {
    //    val bytes = MessageDigest.getInstance("SHA-256").digest(password.toByteArray())
    //    return bytes.joinToString("") { "%02x".format(it) }
    //}

    //fun authenticateTeam(teamName: String, password: String): Boolean {
    //    val expectedHash = teamPasswords[teamName] ?: return false
    //    return hashPassword(password) == expectedHash
    //}

    fun authenticateTeam(teamPasswords: Map<String, String>, teamName: String, providedPassword: String): Boolean {
        val actualPassword = teamPasswords[teamName] ?: return false
        return actualPassword == providedPassword
    }


    fun getOrCreateTeam(teamName: String): Team {
        return teams.computeIfAbsent(teamName) { Team(it) }
    }

    fun getTeam(teamName: String): Team? {
        return teams[teamName]
    }
}