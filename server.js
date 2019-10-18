const fs = require("fs");

//Express Server
const express = require("express");
const app = express();
const port = 3000;
const { db } = require("./modules/db/dbConnection");
const session = require("express-session");
// const FileStore = require('session-file-store')(session);
const bodyParser = require("body-parser");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
passport.use(
  new LocalStrategy((username, password, done) => {
    console.log("got auth request");
    db("users")
    .where({ username: username })
    .then(res => {
      // console.log(userRows)
      const user = res[0];
      if (!user) {
        console.log("User not found");
        done(null, false);
      }

      if (user.password != password) {
        console.log("Wrong Password");
        done(null, false);
      }
      console.log("user found");
      return done(null, user);
    })
    .catch(err => {
      console.log("auth error - ", err);
      done(err);
    });
})
);

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: {}
  })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static("public"));
  passport.serializeUser(function(user, done) {
  console.log("seiralize user -", user.id);
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  // console.log(id)
  db("users")
    .where({ id: id })
    .then(res => {
      // console.log(res)
      done(null, res[0]);
    })
    .catch(error => done(error, false));
});

//Modules
const log = require("./modules/logging.js");
const mustache = require("mustache");
const { addUser } = require("./modules/authentication/newUser.js");
const uuidv1 = require("uuidv1");

//Templating

const newPostPage = fs.readFileSync("./templates/newPost.mustache", "utf8");
const viewPostTemplate = fs.readFileSync(
  "./templates/viewPost.mustache",
  "utf8"
);

//--------------------------------------\\
//           NEW POST ROUTES            \\
//--------------------------------------\\

// let postID = 21; //var to make sure that the post id is correct // checking new post with emtpy table

//try passport.authentication() below

// console.log(req.body)
// console.log("new post user - " + req.user)
// console.log("new post user - " + req.user)

app.post("/newpost", ensureAuth, (req, res, next) => {
  newPostToDB(req) //adds post
    .then(function() {
      // postID++; //increments id //commenting out to test emty table
      res.send(
        `<h1>You submitted a post! Click <a href="/newpost">here</a> to submit another!</h1>`
      );
    })
    .catch(function(err) {
      console.error(err);
      res.status(500).send("you did not submit a post");
    });
});

app.get("/newpost", ensureAuth, function(req, res) {
  console.log(req.user)
  res.send(mustache.render(newPostPage)); //has the submit form
});

//--------------------------------------\\
//         NEW POST FUNCTIONS           \\
//--------------------------------------\\

function newPostToDB(post) {
  slug = uuidv1();
  return db.raw("INSERT INTO posts (post_author, title, content, slug) VALUES (?, ?, ?, ?)", [
    post.user.id,
    post.body.title,
    post.body.content,
    slug
  ]);
}

//--------------------------------------\\
//          VIEW POST ROUTES            \\
//--------------------------------------\\

app.get("/viewpost/:slug", ensureAuth, function(req, res) {
  viewIndividualPost(req.params.slug)
    // res.send(viewPostTemplate)
    .then(function(post) {
      console.log("this is the request slug", req.params.slug);
      // console.log(post.rows[0].title);
      res.send(renderPost(post.rows[0]));
    })
    .catch(function(err) {
      console.error(err);
      res.status(404).send("that post has not been posted yet");
    });
});

//--------------------------------------\\
//        VIEW POST FUNCTIONS           \\
//--------------------------------------\\

function viewIndividualPost(slug) {
  return db.raw("SELECT * FROM posts WHERE slug = ?", [slug]);
}

function renderPost(postFromDb) {
  return `
    <h1>${postFromDb.title}</h1>
    <h4>${postFromDb.content}</h4>
    <p>posted by: ${postFromDb.post_author}</p>
    <p>total attaboys: ${postFromDb.post_attaboys}</p>
    
    `;
}
function prettyPrintJSON(x) {
  return JSON.stringify(x, null, 2);
}

//--------------------------------------\\
//            NEW USER ROUTES           \\
//--------------------------------------\\

app.post("/sign-up", (req, res, nextFn) => {
  addUser(req.body)
    .then(() => {
      res.send("Added user successfully");
    })
    .catch(err => {
      res.status(500).send("this is the error" + err);
      console.err(err);
    });
});

app.get("/sign-up", (req, res) =>
  res.sendFile("newUser.html", { root: __dirname })
);

//--------------------------------------\\
//            Authentication            \\
//--------------------------------------\\

app.get("/auth", (req, res) => res.sendFile("auth.html", { root: __dirname }));

// app.post(
// "/auth",
//   passport.authenticate("local", { failureRedirect: "/error" }),
//   function(req, res) {
//     console.log(req.session)
//     req.session.passport;
//     res.redirect("/success?email=" + req.user.username);
//   }
// );

app.post("/auth", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (info) {
      return res.send(info.message);
    }
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect("/auth");
    }
    req.login(user, err => {
      if (err) {
        return next(err);
      }
      return res.redirect("/auth");
    });
  })(req, res, next);
});

// res.redirect('/success?email='+req.user.username);

app.get("/success", (req, res) =>
  res.send("Welcome " + req.query.email + "!!")
);
app.get("/error", (req, res) => res.send("error logging in"));

function ensureAuth(req, res, next) {
  console.log(req.isAuthenticated());
  if (req.isAuthenticated()) {
    // console.log(req.user)
    next();
  } else {
    res.redirect("/auth");
  }
}

app.listen(port, () => {
  log.info("Listening on port " + port + " 🎉🎉🎉");
});
