const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.SECRET_PAYMENT_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/',(req,res)=>{
  res.send('Spark Vault Running')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.3oeok.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// token verification ==============================
  const verifyToken = (req,res,next)=>{
    if(!req.headers.authorization){
      return res.status(401).send({message : 'unauthorize access'})
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
         if(err){
          return res.status(401).send({message : 'unauthorize access'})
         }
         req.decoded = decoded;
         next();
    })
  }
async function run() {
  try {
  
    // await client.connect();

    const productsCollection = client.db('sparkVault').collection('products')
    const likeCollection = client.db('sparkVault').collection('like')
    const reviewCollection = client.db('sparkVault').collection('reviewData')
    const userCollection = client.db('sparkVault').collection('user')
    const reportCollection = client.db('sparkVault').collection('report')
    const couponCollection = client.db('sparkVault').collection('coupon')

// middle ware for verify admin =================================
    const verifyAdmin = async (req,res,next)=>{
    const email = req.decoded.email;
    const query = {email :email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if(!isAdmin){
      return res.status(403).send({message : 'forbidden access'})
      }
      next();
  }

  // middle ware for moderator ========================
  const verifyModerator = async (req,res,next)=>{
    const email = req.decoded.email;
    const query = {email :email };
    const user = await userCollection.findOne(query);
    const isModerator = user?.role === 'moderator';
    if(!isModerator){
      return res.status(403).send({message : 'forbidden access'})
      }
      next();
  }
       // jwt token generate ===============================
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1d'})
      res.send({token})

    })



// get coupon ========================
app.get('/coupon',async(req,res)=>{
  const result = await couponCollection.find().toArray();
  res.send(result)
})


    // get statistic pi =====================
app.get('/admin/statistics',verifyToken,verifyAdmin, async (req, res) => {
  try {
    const productStats = await productsCollection.aggregate([
      {
        $group: {
          _id: "$status", 
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalReviews = await reviewCollection.countDocuments();
    const totalUsers = await userCollection.countDocuments();
    const data = {
      products: productStats.reduce((acc, item) => {
        acc[item._id] = item.count; 
        return acc;
      }, {}),
      reviews: totalReviews,
      users: totalUsers
    };

    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching statistics.',
      error: error.message
    });
  }
});


// get all products ========================
app.get('/product',verifyToken,verifyModerator, async (req, res) => {
  try {

    const result = await productsCollection
      .find()
      .sort({ status: 1 }) 
      .toArray();
    const sortedResult = result.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0; 
    });

    res.send(sortedResult);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ message: "Failed to fetch products." });
  }
});

// get reported data ========================
app.get('/product/report',verifyToken,verifyModerator, async (req, res) => {
  
    // Fetch all products where reportCount is greater than 0
  const result = await productsCollection
    .find({ reportCount: { $gt: 0 } }) // Filter products with reportCount > 0
    .toArray();
    res.send(result)
  
});

    // get products data ==========================
app.get('/product/:status', async (req, res) => {
  const { sortBy,featured, search, page = 1  , limit  } = req.query;
  const {status} = req.params;
  console.log(status)
  // Sorting criteria
  let sortCriteria = {};
  if (sortBy === 'timestamp') {
    sortCriteria = { timestamp: -1 };
  } else if ( sortBy === 'votes') {
    sortCriteria = { votes: -1 };
  } else {
    sortCriteria = { timestamp: -1 };
  }

  // Filtering criteria
  let filter = { status };

  if (featured === "true") {
  filter.featured = true; // Only include featured products
  }
  let limitCount = 8;
  if (search) {
    filter = {
      tags: { $elemMatch: { $regex: search, $options: 'i' } },
    };
  }
  if(limit){
   limitCount = parseInt(limit)
  }
  try {
    const skip = (parseInt(page) - 1) * parseInt(limit); // Calculate skip value
    const result = await productsCollection
      .find(filter)
      .sort(sortCriteria)
      .skip(skip) // Skip previous pages
      .limit(limitCount) // Limit results to page size
      .toArray();

    const totalProducts = await productsCollection.countDocuments(filter); // Total products
    res.send({ result, totalProducts });
  } catch (error) {
    res.status(500).send({ message: 'Error fetching products', error });
  }
});


//  get one products using id params ==========================
app.get('/product/byId/:id',verifyToken,async(req,res)=>{
  const id = req.params.id;
  const query = {_id : new ObjectId(id)};
  const result = await productsCollection.findOne(query);
  res.send(result);
})

// get review data ==========================
app.get('/review/byId/:id',verifyToken,async(req,res)=>{
  const id = req.params.id;
  const query = {productId : id};
  const result = await reviewCollection.find(query).toArray();
  res.send(result);
})
// get all user =============================
app.get('/user',verifyToken,verifyAdmin,async(req,res)=>{
  const result = await userCollection.find().toArray();
  res.send(result)
})


app.get('/user/byEmail/:email',verifyToken,async(req,res)=>{
  const email = req.params.email;
  const decoded_email = req.decoded.email;
  if(email !== decoded_email){
    return res.status(403).send({message : 'forbidden access'})
  }
  const query = {email : email}
  const result = await userCollection.findOne(query);
  res.send(result)
})
// get user added product ==========================
app.get('/product/byEmail/:email',verifyToken,async(req,res)=>{
  const email = req.params.email;
  const decoded_email = req.decoded.email;
  if(email !== decoded_email){
      return res.status(403).send({message : 'forbidden access'})
    }
  const query = {owner_email : email};
  const result = await productsCollection.find(query).toArray();
  res.send(result);
})
// post product =======================
app.post('/product', verifyToken,async (req, res) => {
  const newProduct = req.body;
  const email = newProduct.owner_email;
  const query = {email : email}
  // Add the default status of 'pending'
  newProduct.status = 'pending';
  newProduct.featured = false;
    
    const user = await userCollection.findOne(query);
    if(user.productAddLimit === 0){
      return res
        .status(200)
        .send({ message: 'You have reached your product addition limit.' });
    }
   if(user.productAddLimit === 1 ||user.
Status === 'verified' || user.productAddLimit === 'unlimited' || role === 'admin' || role === 'moderator'){

  const result = await productsCollection.insertOne(newProduct);
    if (user.productAddLimit === 1) {
        await userCollection.updateOne(
          { email: email },
          { $set: { productAddLimit: 0 } }
        );
      }
  res.send(result);
}
  
});

  // like by user ====================================
app.post('/like', verifyToken, async (req, res) => {
  const newLike = req.body;
  const userEmail = newLike?.liked_by;
  const productId = newLike?.productId;
  const productFilter = { _id: new ObjectId(productId) };
  if (!userEmail || !productId) {
    return res.status(400).json({ message: 'Invalid request data!' });
  }
  const filterProduct = await productsCollection.findOne(productFilter);
  if(userEmail === filterProduct?.owner_email ){
    return res.status(404).send({message : "You can't give like on your own product"})
  }
  try {
    const filter = { liked_by: userEmail, productId: productId };
    const existingLike = await likeCollection.findOne(filter);

    if (existingLike) {
      // Dislike the product (remove the like)
      await likeCollection.deleteOne(filter);

      // Decrement the vote count in the product collection
      
      const update = { $inc: { votes: -1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(200).send({ message: 'Disliked successfully!' });
    } else {
      // Like the product (add the like)
      await likeCollection.insertOne(newLike);

      // Increment the vote count in the product collection
      const productFilter = { _id: new ObjectId(productId) };
      const update = { $inc: { votes: 1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(201).send({ message: 'Liked successfully!' });
    }
  } catch (error) {
    console.error('Error handling like/dislike:', error);
    res.status(500).send({ message: 'Internal server error!' });
  }
});

// report by user ====================================
app.post('/report', verifyToken, async (req, res) => {
  const newReport = req.body;
  const userEmail = newReport?.report_by;
  const productId = newReport?.productId;
  const productFilter = { _id: new ObjectId(productId) };
  if (!userEmail || !productId) {
    return res.status(400).json({ message: 'Invalid request data!' });
  }
   const filterProduct = await productsCollection.findOne(productFilter);
  if(userEmail === filterProduct?.owner_email ){
    return res.status(404).send({message : "You can't give report on your own product"})
  }
  try {
    const filter = { report_by: userEmail, productId: productId };
    const existingReport = await reportCollection.findOne(filter);

    if (existingReport) {
      // Dislike the product (remove the like)
      await reportCollection.deleteOne(filter);

      // Decrement the vote count in the product collection
      
      const update = { $inc: { reportCount: -1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(200).send({ message: 'Report is Removed Successfully!' });
    } else {
      // Like the product (add the like)
      await reportCollection.insertOne(newReport);

      // Increment the vote count in the product collection
      const productFilter = { _id: new ObjectId(productId) };
      const update = { $inc: { reportCount: 1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(201).send({ message: 'Thank you! Your report has been successfully submitted.'});
    }
  } catch (error) {
    console.error('Error handling report:', error);
    res.status(500).send({ message: 'Internal server error!' });
  }
});

// review post ===============================
app.post('/review', verifyToken, async (req, res) => {

    const newReview = req.body;
    const email = newReview.email;
    const productId = newReview.productId;
    const productFilter = { _id: new ObjectId(productId) };
      const filterProduct = await productsCollection.findOne(productFilter);
  if(email === filterProduct?.owner_email ){
    return res.status(404).send({message : "You can't give review on your own product"})
  }
    const query = { email: email, productId: productId };
 
    const isExist = await reviewCollection.findOne(query);
    if (isExist) {
      return res.status(409).send({ message: "You have already submitted a review for this product!" });
    }

    const result = await reviewCollection.insertOne(newReview);
    res.status(201).send({ message: "Review submitted successfully!", result });
    res.send(result);
    
});
  
// user ===============
app.post('/user',async(req,res)=>{
  const user = req.body;
  const email = user.email;
  const query = {email : email};
  const isExist = await userCollection.findOne(query);
  if(isExist){
    return res.send({message : 'user already exist', insertedId: null});
  }else{
    user.productAddLimit = 1;
    const result = await userCollection.insertOne(user);
    res.send(result)
  }
})
//  post coupon by admin ====================
app.post('/coupon',verifyToken,verifyAdmin,async(req,res)=>{
  const newCoupon = req.body;
  const result = await couponCollection.insertOne(newCoupon);
  res.send(result);
})
// delete product ==========================
app.delete('/product/:id',verifyToken,async(req,res)=>{
  const id = req.params.id;
  const query = {_id : new ObjectId(id)}
  const result = await productsCollection.deleteOne(query);
  res.send(result)
})
// update product data ==========================
app.put('/product/:id',verifyToken, async (req, res) => {
  const id = req.params.id;
  const data = req.body;
  const query = { _id: new ObjectId(id) };
  const update = {
    $set: {
      owner_name: data.owner_name,
      owner_email: data.owner_email,
      owner_image: data.owner_image,
      product_name: data.product_name,
      product_image: data.product_image,
      web_link: data.web_link,
      description: data.description,
      tags: data.tags || [], 
      timestamp: new Date(), 
      votes: data.votes || 0,
      reportCount: data.reportCount || 0,
      status: data.status || "pending",
      featured : data.featured || false,
    },
  };

    const result = await productsCollection.updateOne(query, update);
  res.send(result)
  
});
// update coupon by admin =======================
app.put('/coupon/:id',verifyToken,verifyAdmin,async(req,res)=>{
  const id = req.params.id;
  const data = req.body;
  const query = {_id : new ObjectId(id)};
  const update = {
    $set : {
      couponCode: data.couponCode,
      expiryDate: data.expiryDate,
      description: data.description,
      discountAmount : data.discountAmount
    }
  }
  const result = await couponCollection.updateOne(query,update);
  res.send(result)
})
// make moderator ==========================
app.patch('/user/moderator/:email',verifyToken,verifyAdmin,async(req,res)=>{
  const email = req.params.email;
  const query = {email : email};
  
  const {role} = req.body;
  const user = await userCollection.findOne(query);
  if(user?.role !== 'user'){
    return
  }
  const update = {
    $set : {
      role,
    }
  }
  const result = await userCollection.updateOne(query,update)
  res.send(result)
})
// make admin ==========================
app.patch('/user/admin/:email',verifyToken,verifyAdmin,async(req,res)=>{
  const email = req.params.email;
  const query = {email : email};
  
  const {role} = req.body;
  const user = await userCollection.findOne(query);
  if(user?.role === 'admin'){
    return
  }
  const update = {
    $set : {
      role,
    }
  }
  const result = await userCollection.updateOne(query,update)
  res.send(result)
})
// make product featured ========================
app.patch('/product/featured/:id', verifyToken,verifyModerator, async (req, res) => {
  const id = req.params.id;

  const query = { _id: new ObjectId(id) };
  const { featured } = req.body;

  const product = await productsCollection.findOne(query);

  if (product?.featured) {
      return res.status(400).send({ message: "This product is already featured." });
    }


    const update = {
      $set: {
        featured,
        status: "Accepted",
      },
    };

    const result = await productsCollection.updateOne(query, update);
    res.send(result);
  
});

// make product accepted =========================
app.patch('/product/status/:id',verifyToken,verifyModerator, async (req, res) => {
  const id = req.params.id;

  const query = { _id: new ObjectId(id) };
  const { status } = req.body;

  const product = await productsCollection.findOne(query);

  if (product?.status === 'Accepted') {
      return res.status(400).send({ message: "This product is already Accepted ." });
    }


    const update = {
      $set: {
        status,
      },
    };

    const result = await productsCollection.updateOne(query, update);
    res.send(result);
  
});
// delete reported product ==========================
app.delete('/reportedProduct/:id',verifyToken,verifyModerator,async(req,res)=>{
  const id = req.params.id;
  const query = {_id : new ObjectId(id)};
  const result = await productsCollection.deleteOne(query);
  res.send(result)
})
// delete coupon by admin =====================
app.delete('/coupon/:id',verifyToken,verifyAdmin,async(req,res)=>{
  const id = req.params.id;
  const query = {_id : new ObjectId(id)};
  const result = await couponCollection.deleteOne(query);
  res.send(result);
})
app.patch('/userStatus/:email',verifyToken,async(req,res)=>{
  const {status} = req.body;
  const email = req.params.email;
  const query = {email : email};
  const update = {
    $set : {
      status,
    }
  }
  const result = await userCollection.updateOne(query,update);
  res.send(result)
})
  // payment Intent ============================
    app.post('/create-checkout-session',async(req,res)=>{
      const {price} = req.body;
      if (!price || isNaN(price) || price <= 0) {
      return res.status(400).send({ error: "Invalid price value" });
      }
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ['card']
      });
      res.send({
        clientSecret : paymentIntent.client_secret
      })
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

















app.listen(port,()=>{
  console.log(`My Port is ${port}`)
})