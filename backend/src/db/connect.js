// PostgreSQL connection for Where's the Game
import pg from "pg";

const pool = new pg.Pool({
    user: "postgres",
    host: "localhost",
    database: "wheres_the_game",
    password: "yourpassword",
    port: 5432
});

export default pool;
