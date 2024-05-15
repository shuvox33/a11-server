const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')

const corsConfig = {
    origin : "*",
    Credential: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
};
app.options("", cors(corsConfig))

//middleware
app.use(cors({
    origin :[
        'https://a11-hunger-help.web.app',
        'http://localhost:5173'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5metfvs.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares


const verifyToken = (req, res, next) =>{
    const token = req?.cookies?.token;
    console.log('token in the middleware :', token);
    if(!token){
        return res.send({message : 'unauthorized access'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
            console.log("not good");
            return res.send({message : 'unauthorized access'})
        }
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        // auth realted api
        app.post('/jwt', async(req,res)=>{
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn : '1h'})

            res.cookie('token', token,{
                httpOnly : true,
                secure : true,
                sameSite :'none'
            }).send("success")
        })

        app.post('/logout', async (req, res)=>{
            const user = req.body;
            res.clearCookie('token', {maxAge : 0}).send({success : true})
        })


        // services related api
        const foodCollection = client.db("foodHunger").collection("availableFoods");
        const reqFoodCollection = client.db("foodHunger").collection("requestFoods");

        app.post('/foods', async (req, res) => {
            const newFood = req.body;
            const result = await foodCollection.insertOne(newFood)
            res.send(result)
        })

        app.post('/reqfoods', async (req, res) => {
            const newReqFood = req.body;
            const result = await reqFoodCollection.insertOne(newReqFood)
            res.send(result)
        })

        app.get('/foods',  async (req, res) => {
            const cursor = foodCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        // Fetch the data while sorting based on the food quantity
        app.get('/sortedfoods', async (req, res) => {
            try {
                const data = await foodCollection.find().toArray();
                const intResult = data.map((item) => ({
                    ...item,
                    quantity: parseInt(item.quantity) 
                }));

                const result =  intResult.sort((a,b)=> b.quantity - a.quantity).slice(0,6)
                
                res.send(result);
            } catch (error) {
                console.error('Error:', error); 
                res.status(500).send(error);
            }
        });


        app.get('/reqfoods',   async (req, res) => {
            let query;

            if (req.query.foodId) {
                query = { food_id: req.query?.foodId }
            }
            else if (req.query.reqEmail) {
                query = { reqMail: req.query?.reqEmail }
            }

            const cursor = reqFoodCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/foods/:id',  async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await foodCollection.findOne(query)
            res.send(result);
        })


        app.put('/foods/:id',  async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedFood = req.body;

            const food = {
                $set: {
                    foodName: updatedFood.foodName,
                    foodImage: updatedFood.foodImage,
                    location: updatedFood.location,
                    quantity: updatedFood.quantity,
                    notes: updatedFood.notes,
                    expireDate: updatedFood.expireDate
                }
            }
            const result = await foodCollection.updateOne(filter, food, options)
            res.send(result)

        })
        app.put('/reqfoods/:id',  async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedReqFood = req.body;

            const ReqFood = {
                $set: {
                    status: updatedReqFood.status
                }
            }
            const result = await reqFoodCollection.updateOne(filter, ReqFood, options)
            res.send(result)

        })

        app.delete('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.deleteOne(query);
            res.send(result);
        })
        app.delete('/reqfoods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reqFoodCollection.deleteOne(query);
            res.send(result);
        })

        // request food



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('running')
})

app.listen(port, () => {
    console.log(`running on port :${port}`);
})