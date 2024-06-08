const express = require("express");
const app = express();
var cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5kgqkgx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db("contestForgeDB").collection("users");
    const contestCollection = client
      .db("contestForgeDB")
      .collection("contests");
    const paymentCollection = client
      .db("contestForgeDB")
      .collection("payments");

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // use verify contest creator after verify token
    const verifyCreator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isCreator = user?.role === "Creator";
      if (!isCreator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // search api
    app.get("/search", async (req, res) => {
      const searchTerm = req.query.q;
      if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
      }
      const result = await contestCollection
        .find({ contestType: { $in: [searchTerm] } })
        .toArray();
      res.send(result);
    });

    // users api
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/user/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      // Validate the role
      // const allowedRoles = ['Admin', 'Creator', 'User'];
      // if (!allowedRoles.includes(role)) {
      //   return res.status(401).send({ error: 'Invalid role' });
      // }
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/user/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/update-profile/:email", async (req, res) => {
      const { email } = req.params;
      const updateInfo = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: { ...updateInfo },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //  contest api
    app.get("/addContest", async (req, res) => {
      const result = await contestCollection.find().toArray();
      res.send(result);
    });

    app.get("/popular-contests", async (req, res) => {
      const popularContests = await contestCollection
        .find({})
        .sort({ participationCount: -1 })
        .limit(6)
        .toArray();
      res.send(popularContests);
    });

    app.get("/addContest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    app.get("/createdContest/:email", async (req, res) => {
      const email = req.params.email;
      const result = await contestCollection.find({ email }).toArray();
      res.send(result);
    });
    app.post("/addContest", verifyToken, verifyCreator, async (req, res) => {
      const contest = req.body;
      const result = await contestCollection.insertOne(contest);
      res.send(result);
    });

    app.delete("/createdContest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/createdContes/:id", async (req, res) => {
      const id = req.params.id;
      const contest = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...contest },
      };
      const result = await contestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/status/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...status },
      };
      const result = await contestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/comment/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const comment = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...comment },
      };
      const result = await contestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/participationCount/:id", async (req, res) => {
      const { id } = req.params;
      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { participationCount: 1 } }
      );
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      // if (req.params.email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/contest-submissions/:name", async (req, res) => {
      const contestName = req.params.name;
      const query = { contestName: contestName };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    //  contest winner percentage
    app.get("/user-contests/:email", async (req, res) => {
      const { email } = req.params;
      const contests = await paymentCollection.find({ email }).toArray();
      const totalContests = contests.length;
      const wins = contests.filter((contest) => contest.winner).length;
      const winPercentage =
        totalContests > 0 ? (wins / totalContests) * 100 : 0;
      res.send({ contests, winPercentage });
    });

    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
    });

    app.patch("/declare-winner/:id", async (req, res) => {
      const { id } = req.params;
      const { contestName } = req.body;

      // Unset previous winners for this contest
      await paymentCollection.updateMany(
        { contestName },
        { $set: { winner: false } }
      );

      // Set the new winner
      const result = await paymentCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { winner: true } }
      );

      res.send(result);
    });

    // winner stats
    app.get("/contest-stats", async (req, res) => {
      try {
        const latestWinner = await paymentCollection.findOne(
          { winner: true },
          { sort: { _id: -1 } }
        );
        const participationCount = await paymentCollection.countDocuments();
        const totalWinnerCount = await paymentCollection.countDocuments({
          winner: true,
        });

        res.json({
          latestWinner,
          participationCount,
          totalWinnerCount,
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching contest statistics", error });
      }
    });

    // top contest collection
    app.get("/top-creators", async (req, res) => {
      const topCreators = await contestCollection
        .find({})
        .sort({ participationCount: -1 })
        .limit(3)
        .toArray();

      res.send(topCreators);
    });

    // leaderBoard
    app.get('/leaderboard', async (req, res) => {
      try {
        const winners = await paymentCollection.aggregate([
          { $match: { winner: true } },
          {
            $group: {
              _id: "$email",
              winCount: { $sum: 1 },
              details: { $first: { name: "$name", photo: "$photo", email: "$email" } }
            }
          },
          { $sort: { winCount: -1 } },
          { $limit: 10 }
        ]).toArray();

        const leaderboard = await Promise.all(winners.map(async (winner) => {
          const userDetails = await usersCollection.findOne({ email: winner._id });
          if (userDetails) {
            return {
              ...winner.details,
              winCount: winner.winCount
            };
          }
          return null;
        }));

        const validLeaderboard = leaderboard.filter(entry => entry !== null);

        res.json(validLeaderboard);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello ContestForge");
});

app.listen(port, () => {
  console.log(`ContestForge running on port ${port}`);
});
