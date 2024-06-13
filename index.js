const port = 4000;
const express = require("express");
const app = express();
const mongoose = require('mongoose');
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const env = require("dotenv");

app.use(express.json());
app.use(cors());
env.config();

//DB connection
const dbURI = process.env.MONGO_URI;


// DB connection
mongoose.connect(dbURI, {

}).then(() => {
    console.log("Connected to the database");
}).catch((err) => {
    console.error("Database connection error:", err);
});


//API Creation
app.get("/", (req, res) => {
    res.send("Express app is running")
})

// Image Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'upload', 'images')); // Ensure this directory exists
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Upload Endpoint for images
app.use("/images", express.static(path.join(__dirname, 'upload', 'images')));

app.post("/upload", upload.single("product"), (req, res) => {
    res.json({
        success: 1,
        image_url: `https://e-commerce-backend-p53b.onrender.com/images/${req.file.filename}` // Use your actual Render URL
    });
});

//Schema for Products

const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    new_price: {
        type: Number,
        required: true
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now
    },
    available: {
        type: Boolean,
        default: true
    }
})

app.post("/addproduct", async (req, res) => {

    let products = await Product.find({});
    let id;
    if (products.length > 0) {
        let last_product_array = products.slice(-1); // Get last product that was inserted
        let last_product = last_product_array[0];
        id = last_product.id + 1
    }
    else {
        id = 1;
    }

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });

    console.log(product);

    await product.save();
    console.log("Saved");
    res.json({
        success: true,
        name: req.body.name
    })
})

//API for deleting Products 

app.post("/removeproduct", async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Removed");
    res.json({
        success: true,
        name: req.body.name
    })
})

//Creating API for getting all products

app.get("/allproducts", async (req, res) => {
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
})

// Schema for User

const Users = mongoose.model("Users", {
    username: {
        type: String,
    },
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object
    },
    date: {
        type: Date,
        default: Date.now
    }
})

//Creating Endpoint for registering the user

app.post("/signup", async (req, res) => {

    let check = await Users.findOne({ email: req.body.email });

    if (check) {
        return res.status(400).json({ success: false, errors: "Existing User found!" });
    }

    let cart = {};

    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart
    })

    await user.save();

    //JWT token

    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, "secret_ecom");
    res.json({ success: true, token })
})

//Endpoint for User Login

app.post("/login", async (req, res) => {

    let user = await Users.findOne({ email: req.body.email });

    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            }

            const token = jwt.sign(data, "secret_ecom");

            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, errors: "Wrong Password" });
        }
    }
    else {
        res.json({ success: false, errors: "Invalid Email" });
    }
})

//Endpoint for NewCollection data

app.get("/newcollection", async (req, res) => {

    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8) // To get recently added 8 products
    console.log("New Colleciton Fetched");
    res.send(newcollection);
})

//Endpoint for Popular_In_Women section

app.get('/popularinwomen', async (req, res) => {

    let products = await Product.find({ category: "women" });
    let popular_in_women = products.slice(0, 4);
    console.log("Popular in Women fetched");
    res.send(popular_in_women);
})

//Middleware to fetch User
const fetchUser = async (req, res, next) => {
    const token = req.header("auth-token");

    if (!token) {
        res.status(401).send({ errors: "Please authenticate using valid token" });
    }
    else {
        try {
            const data = jwt.verify(token, "secret_ecom");
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({ errors: "Please authenticate using a valid token" });
        }
    }
}

//Endpoint for adding products in cartdata

app.post("/addtocart", fetchUser, async (req, res) => {

    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;

    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

    res.send("Added to Cart");
})

//Endpoint to remove product from cartData

app.post("/removefromcart", fetchUser, async (req, res) => {

    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] > 0)
        userData.cartData[req.body.itemId] -= 1;

    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

    res.send("Removed from Cart");
})

//Endpoint to get CartData 

app.post("/getcart", fetchUser, async (req, res) => {
    
    console.log("GetCart");
    let userData = await Users.findOne({_id: req.user.id});
    res.json(userData.cartData);
})

app.listen(port, (err) => {
    if (!err)
        console.log("Server running on port " + port)
    else {
        console.log("Error : " + err);
    }
})