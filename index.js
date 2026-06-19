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
    const proposalCollection = database.collection("proposalCollection");

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

    //get all proposal 
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

    // proposal submit
    app.post('/proposals', async (req, res) => {
      try {
        const newProposal = req.body;
        const query = {
          task_id: newProposal.task_id,
          freelancer_email: newProposal.freelancer_email
        };
        const alreadyApplied = await proposalsCollection.findOne(query);

        if (alreadyApplied) {
          return res.status(400).send({
            success: false,
            message: "You have already submitted a proposal for this task!"
          });
        }
        const result = await proposalsCollection.insertOne(newProposal);

        res.status(201).send({
          success: true,
          message: "Proposal inserted into database successfully",
          insertedId: result.insertedId
        });

      } catch (error) {
        console.error("Error inserting proposal:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });

    //get proposal data
    app.get('/proposals/:freelancerEmail', async (req, res) => {
      try {
        const email = req.params.freelancerEmail;
        const query = { freelancer_email: email };
        const result = await proposalsCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Backend error while fetching proposals:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });

    //update profile data
    app.patch('/users/:email', async (req, res) => {
      try {
        const userEmail = req.params.email; 
        const updatedData = req.body; 
        const filter = { email: userEmail };

        const updateDoc = {
          $set: {
            name: updatedData.name,
            image: updatedData.image,
            skills: updatedData.skills, 
            bio: updatedData.bio,
            hourly_rate: updatedData.hourly_rate,
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: "User profile not found" });
        }

        res.status(200).send({ success: true, message: "Profile updated successfully" });
      } catch (error) {
        console.error("Backend error while updating user profile:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });

    //update proposal info, task submit
    app.patch("/proposals/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status, deliverable_url } = req.body;

        // ইউআরএল থেকে পাওয়া আইডি দিয়ে ফিল্টার তৈরি
        const filter = { _id: new ObjectId(id) };

        // ডাটাবেজে কী কী আপডেট হবে (স্ট্যাটিক কমপ্লিট স্ট্যাটাস এবং কাজের লিংক)
        const updateDoc = {
          $set: {
            status: status, // ফ্রন্টএন্ড থেকে "Completed" আসবে
            deliverable_url: deliverable_url,
            updated_at: new Date(), // আপডেটের সময় ট্র্যাক রাখার জন্য
          },
        };

        const result = await proposalsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1) {
          res.status(200).send({ success: true, message: "Proposal updated successfully!" });
        } else {
          res.status(404).send({ success: false, message: "Proposal not found or no changes made." });
        }
      } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).send({ success: false, message: "Internal server error" });
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