const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URL;
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const database = client.db("SkillSwap");
    const userCollection = database.collection("userCollection");
    const taskCollection = database.collection("taskCollection");

    //insert create profile data
    app.post("/user", async (req, res) => {
      try {
        const profileData = req.body;

        // Safety check: Validate that email is present in the request body
        if (!profileData.email) {
          return res.status(400).json({
            success: false,
            error: "Email is strictly required to create a profile"
          });
        }

        // Since it's a completely separate collection and first-time entry, we use insertOne
        const result = await userCollection.insertOne(profileData);

        // Return clean success response wrapper back to Next.js front-end
        res.status(200).json({
          success: true,
          message: "Profile created and stored successfully in the collection",
          result
        });

      } catch (error) {
        // Catching database or network failures safely
        res.status(500).json({
          success: false,
          error: error.message || "Internal server error occurred while inserting configuration"
        });
      }
    });

    //get user info
    app.get("/user/:email", async (req, res) => {
      try {
        const userEmail = req.params.email;
        const user = await userCollection.findOne({ email: userEmail });
        res.status(200).json({
          success: true,
          user: user,
        });

      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    //get all task 
    app.get("/browse-tasks", async (req, res) => {
      try {
        const result = await taskCollection.find().toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch tasks" });
      }
    });

    //get task details
    app.get('/browse-tasks/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const task = await taskCollection.findOne(query);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }
        res.status(200).json(task);
      } catch (error) {
        console.error("Error fetching task details by ID:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });














    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})