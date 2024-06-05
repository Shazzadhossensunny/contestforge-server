const express = require('express')
const app = express()
var cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
     const usersCollection = client.db('contestForgeDB').collection('users')
     const contestCollection = client.db('contestForgeDB').collection('contests')
     const paymentCollection = client.db('contestForgeDB').collection('payments')

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
        const isAdmin = user?.role === "admin";
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
        const isCreator = user?.role === "creator";
        if (!isCreator) {
          return res.status(403).send({ message: "forbidden access" });
        }
        next();
      };
      // search api
      app.get('/search', async(req,res)=>{
        const  searchTerm = req.query.q;
        if(!searchTerm){
          return res.status(400).json({ message: 'Search term is required' });
        }
        const result = await contestCollection.find({contestType:{$in:[searchTerm]}}).toArray()
        res.send(result)
      })

      // users api
      app.get("/users", async(req, res)=> {
        const result = await usersCollection.find().toArray()
        res.send(result);
      })
       app.get("/user/:email", async(req, res)=>{
        const email = req.params.email;
        const result = await usersCollection.findOne({email})
        res.send(result)
       })

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

      app.patch("/user/:id", async(req, res)=>{
        const id = req.params.id;
        const {role} = req.body;

      // Validate the role
        // const allowedRoles = ['Admin', 'Creator', 'User'];
        // if (!allowedRoles.includes(role)) {
        //   return res.status(401).send({ error: 'Invalid role' });
        // }
        const filter = {_id: new ObjectId(id)}
        const updateDoc = {
          $set:{
            role :role,

          }
        }
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.send(result)

      })

      app.patch("/user/status/:id", async(req, res)=>{
        const id = req.params.id;
        const {status} = req.body;
        const filter = {_id: new ObjectId(id)}
        const updateDoc = {
          $set:{
            status: status,
          }
        }
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.send(result)

      })

      app.delete("/users/:id", async(req, res)=> {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await usersCollection.deleteOne(query)
        res.send(result)
      })


    //  contest api
    app.get("/addContest", async(req,res)=>{
      const result = await contestCollection.find().toArray()
      res.send(result)

    })

    app.get("/addContest/:id", async(req, res)=> {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await contestCollection.findOne(query)
      res.send(result)

    })

    app.get('/createdContest/:email', async(req, res)=>{
      const email = req.params.email;
      const result = await contestCollection.find({email}).toArray()
      res.send(result)
    })
    app.post("/addContest", async(req, res)=>{
      const contest = req.body;
      const result = await contestCollection.insertOne(contest)
      res.send(result)
    })

    app.delete('/createdContest/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await contestCollection.deleteOne(query)
      res.send(result)
    })

    app.patch('/createdContes/:id', async(req, res)=>{
      const id = req.params.id;
      const contest = req.body;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set : {...contest}
      }
      const result = await contestCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.patch('/status/:id', async(req, res)=>{
      const id = req.params.id;
      const status = req.body;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {...status }
      }
      const result = await contestCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    app.patch('/comment/:id', async(req, res)=>{
      const id = req.params.id;
      const comment = req.body;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {...comment }
      }
      const result = await contestCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.patch('/participationCount/:id', async(req, res)=>{
      const {id} = req.params;
      const result = await contestCollection.updateOne(
        {_id: new ObjectId(id)},
        {$inc: { participationCount: 1}}
      );
      res.send(result)
    })



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

    app.get("/payment/:email", verifyToken, async(req, res)=>{
      const email = req.params.email;
      const query = {email}
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/payment", async(req,res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult)
    })












    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello ContestForge')
  })

  app.listen(port, () => {
    console.log(`ContestForge running on port ${port}`)
  })