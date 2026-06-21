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
    const proposalsCollection = database.collection("proposalsCollection");
    const paymentCollection = database.collection("paymentCollection");

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

        // Since it's a completely separate collection and last-time entry, we use insertOne
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
            firstName: updatedData.firstName,
            lastName: updatedData.lastName,
            image: updatedData.image,
            skills: updatedData.skills,
            bio: updatedData.bio,
            hourlyRate: updatedData.hourlyRate,
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
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
    app.patch("/proposals-update/:id", async (req, res) => {
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

    //get completed task info
    app.get("/earnings/:email", async (req, res) => {
      try {
        const freelancerEmail = req.params.email;
        const query = {
          freelancer_email: freelancerEmail,
          status: "completed"
        };
        const result = await proposalsCollection.find(query).sort({ updated_at: -1 }).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    //client section
    //insert posted data
    app.post("/post-task", async (req, res) => {
      try {
        const newTask = req.body;
        if (!newTask.title || !newTask.clientEmail) {
          return res.status(400).json({ success: false, message: "Required data is missing." });
        }
        const result = await taskCollection.insertOne(newTask);

        if (result.insertedId) {
          return res.status(201).json({
            success: true,
            message: "Task published successfully!",
            taskId: result.insertedId
          });
        } else {
          return res.status(500).json({ success: false, message: "Failed to insert task." });
        }

      } catch (error) {
        console.error("Express Error inside /tasks POST:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
      }
    });

    //get posted task data
    app.get("/my-tasks/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const tasks = await taskCollection.find({ clientEmail: email }).sort({ createdAt: -1 }).toArray();

        res.status(200).json({ success: true, tasks });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //get proposed data through client email - post task
    app.get("/client-proposals/:email", async (req, res) => {
      try {
        const clientEmail = req.params.email;
        const submissions = await proposalsCollection.find({ client_email: clientEmail }).toArray();
        return res.status(200).json({ success: true, submissions });
      } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    });

    //update posted data info
    app.patch("/task-update/:id", async (req, res) => {
      try {
        const taskId = req.params.id;
        const updatedFields = req.body;
        if (Object.keys(updatedFields).length === 0) {
          return res.status(400).json({ success: false, message: "No data provided for update" });
        }
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(taskId) },
          { $set: updatedFields }
        );
        if (result.matchedCount === 1) {
          return res.status(200).json({
            success: true,
            message: "Task updated successfully!",
          });
        } else {
          return res.status(404).json({
            success: false,
            message: "Task not found or no changes made.",
          });
        }

      } catch (error) {
        console.error("Express Error inside PATCH /task-update/:id:", error);
        return res.status(500).json({
          success: false,
          message: error.message || "Internal Server Error",
        });
      }
    });

    //delete posted data
    app.delete('/tasks/:id', async (req, res) => {
      try {
        const taskId = req.params.taskId;
        const query = { _id: new ObjectId(taskId) };
        const result = await taskCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).send({ success: true, message: "Task deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Task not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: "Internal Server Error", error: error.message });
      }
    });

    //update status for accept/ignore button
    app.patch("/proposal-status/:id", async (req, res) => {
      try {
        const proposalId = req.params.id;
        const { status } = req.body;
        const result = await proposalCollection.updateOne(
          { _id: new ObjectId(proposalId) },
          { $set: { status: status } }
        );

        if (result.matchedCount === 1) {
          return res.status(200).json({ success: true, message: `Proposal ${status} successfully!` });
        }
        return res.status(404).json({ success: false, message: "Proposal not found" });
      } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    });

    //update status afte payment
    app.post("/api/payments/confirm", async (req, res) => {
      try {
        const { infoField } = req.body;
        if (!infoField) {
          return res.status(400).json({ success: false, message: "Missing infoField in body" });
        }

        const { taskId, proposalId, sessionId } = infoField;

        if (!taskId || !proposalId || !sessionId) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: taskId, proposalId, or sessionId"
          });
        }
        const proposalUpdate = await proposalCollection.updateOne(
          { _id: new ObjectId(proposalId) },
          { $set: { status: "in-progress" } }
        );
        const taskUpdate = await taskCollection.updateOne(
          { _id: new ObjectId(taskId) },
          { $set: { status: "closed" } }
        );
        const taskData = await taskCollection.findOne({ _id: new ObjectId(taskId) });
        const proposalData = await proposalCollection.findOne({ _id: new ObjectId(proposalId) });
        const newPayment = {
          client_email: taskData?.clientEmail || "",
          freelancer_email: proposalData?.freelancer_email || "",
          task_id: taskId,
          task_title: taskData?.title || "",
          amount: Number(proposalData?.proposed_budget || 0),
          transaction_id: sessionId,
          payment_status: "succeeded",
          paid_at: new Date()
        };

        const paymentInsert = await paymentCollection.insertOne(newPayment);
        if (
          proposalUpdate.modifiedCount > 0 &&
          taskUpdate.modifiedCount > 0 &&
          paymentInsert.insertedId
        ) {
          return res.status(200).json({
            success: true,
            message: "Payment successfully verified. Database collections updated!",
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "Failed to update statuses. Please check if IDs are correct.",
          });
        }

      } catch (error) {
        console.error("Express Payment Confirm Error:", error);
        return res.status(500).json({ success: false, message: error.message });
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