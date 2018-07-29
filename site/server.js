// Run a node.js web server for local development of a static web site.
// Start with "node server.js" and put pages in a "public" sub-folder.
// Visit the site at the address printed on the console.

// The server is configured to be platform independent.  URLs are made lower
// case, so the server is case insensitive even on Linux, and paths containing
// upper case letters are banned so that the file system is treated as case
// sensitive even on Windows.  All .html files are delivered as
// application/xhtml+xml for instant feedback on XHTML errors.  To improve the
// server, either add content negotiation (so old browsers can be tested) or
// switch to text/html and do validity checking another way (e.g. with vnu.jar).

// Choose a port, e.g. change the port to the default 80, if there are no
// privilege issues and port number 80 isn't already in use. Choose verbose to
// list banned files (with upper case letters) on startup.

// var port = 8080;
var verbose = true;
var OK = 200, NotFound = 404, BadType = 415, Error = 500;
var types, banned;

// Load the library modules, and define the global constants.
// See http://en.wikipedia.org/wiki/List_of_HTTP_status_codes.
// Start the server:

// var http = require("http");
var express = require('express');
var bodyParse = require('body-parser');

var sql = require('sqlite3').verbose();
var db = new sql.Database('./database/mydb.db');

var app = express();

var validUrl = require('valid-url');
var url = require('url');
var fs = require("fs");

var banned = [];
banUpperCase("./public/", "");


app.use(lower);
app.use(ban);
// app.use("/auth.html", auth);
app.set('port', 443);
app.set("view engine", "pug")

var options = {setHeaders: deliverXHTML};
var error = function(err, response, body){
    console.log('ERROR[%d]', err);
}


//check url validation
app.use(function (req, res, next) {
    url = req.url.toLowerCase();
    console.log("url:", url);
    if(url_validation(url)){
        next();
    }
    else {
        console.log('URI invalid:',url);
        res.render('error', {"message": "Don't be naughty. This is not a validated URL."});       
    }
});

app.use(express.static("./public/", options));

app.listen(app.get('port'), "localhost");
var address = "http://localhost";
address = address + ":" + app.get('port');
console.log("Server running at", address);


// Make the URL lower case.
function lower(req, res, next) {
    req.url = req.url.toLowerCase();
    next();
}

// Forbid access to the URLs in the banned list.
function ban(req, res, next) {
    for (var i=0; i<banned.length; i++) {
        var b = banned[i];
        if (req.url.startsWith(b)) {
            res.status(404).send("Filename not lower case");
            return;
        }
    }
    next();
}

// function auth(req, res, next){
//     res.redirect("/login.html");
// }

// Called by express.static.  Deliver response as XHTML.
function deliverXHTML(res, path, stat) {
    if (path.endsWith(".html")) {
        res.header("Content-Type", "application/xhtml+xml");
    }
}

function getFullUrl(req, callback) {
    callback(url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: req.originalUrl
    }));
}

//forbid url don't start with '/' or contain // or /. or /..
function url_validation(url) {
    if (url.indexOf("/") != 0) return false;
    if (url.indexOf("/.") > -1)
        return false;
    if (url.indexOf("//") > -1)
        return false;
    if (url.indexOf("/..") > -1)
        return false;
    return true;
}


// Check a folder for files/subfolders with non-lowercase names.  Add them to
// the banned list so they don't get delivered, making the site case sensitive,
// so that it can be moved from Windows to Linux, for example. Synchronous I/O
// is used because this function is only called during startup.  This avoids
// expensive file system operations during normal execution.  A file with a
// non-lowercase name added while the server is running will get delivered, but
// it will be detected and banned when the server is next restarted.
function banUpperCase(root, folder) {
    var folderBit = 1 << 14;
    var names = fs.readdirSync(root + folder);
    for (var i=0; i<names.length; i++) {
        var name = names[i];
        var file = folder + "/" + name;
        if (name != name.toLowerCase()) {
            if (verbose) console.log("Banned:", file);
            banned.push(file.toLowerCase());
        }
        var mode = fs.statSync(root + file).mode;
        if ((mode & folderBit) == 0) continue;
        banUpperCase(root, file);
    }
}

app.use(bodyParse.json());
app.use(bodyParse.urlencoded({
    extended:true
}));

app.post('/signup', function(req, res){
    console.log(req.body);
    
    // var username = req.getParameter("username");
    var username = req.body.Username.trim();
    var password = req.body.Password.trim();
    var mail = req.body.Mail.trim();
    var phone = req.body.Phone.trim();
    var address = req.body.Address.trim();


    db.run("INSERT INTO user_info VALUES(?, ?, ?, ?, ?)",username, password, mail, phone, address, function(err){
        if(err){
            console.log(err);
            // res.render("register_result",
                // {'result':"Woops!",'detail':"There is some technical problems. Please try again later."});
        } else {
            console.log("done");
            // res.send("register successfully!");
            res.redirect('/');
            // res.render("register_result", {'result':"Welcome to Join in Come and Eat"});
        }
    });
});

app.post('/login', function(req, res){
    var username = req.body.Username.trim();
    var password = req.body.Password.trim();

    var stmt = db.prepare("SELECT * FROM user_info WHERE username = $username AND password = $password ");
    stmt.get({$username: username, $password: password}, function(err, row){
        if(err){
            console.log("err->", err);
            res.send("false");
        } else {
            if(row == undefined){
                res.send("false");
            } else {
                console.log(row);
                res.render("user_page", {
                    user: row
                });
                // res.send("Login successfully! Hi " + row.username + ", your phone number is " + row.phone);
            }
        }
    });
    stmt.finalize();
});


app.post('/flavour', function(req, res){
    var flavour = req.body.flavour.trim();

    var stmt = db.prepare("SELECT user_info.username as name, food.name as food, food.flavour as flavour, accommodation.name as accommodation, user_info.phone as phone FROM food JOIN user_info ON user_info.username = food.owner JOIN accommodation ON accommodation.name = user_info.address WHERE food.flavour = $flavour ");
    stmt.all({$flavour: flavour}, function(err, row){
        if(err){
            console.log("err->", err);
            res.send("false");
        } else {
            if(row == undefined){
                res.send("false");
            } else {
                console.log(row);
                res.render("search_page", {
                    form: 1,
                    search_theme: flavour,
                    rows: row,
                    rows_len: row.length
                    // user0: row[0],
                    // user1: row[1],
                    // user2: row[2],
                    // user3: row[3],
                    // user4: row[4]
                })
            }
        }
    });
    stmt.finalize();
});

app.post('/postcode', function(req, res){
    var postcode = req.body.postcode.trim();

    // var stmt = db.prepare("SELECT * FROM food JOIN user_info ON user_info.username = food.owner JOIN accommodation ON accommodation.name = user_info.address LIMIT 5");
    var stmt = db.prepare("SELECT accommodation.postcode as postcode, food.name As food, food.cuisine as cuisine, accommodation.name as accommodation, user_info.phone as phone FROM food JOIN user_info ON user_info.username = food.owner JOIN accommodation ON accommodation.name = user_info.address WHERE accommodation.postcode = $postcode");

    stmt.all({$postcode: postcode}, function(err, row){
    // stmt.all(function(err, row){
        if(err){
            console.log("err->", err);
            res.send("false");
        } else {
            if(row == undefined){
                res.send("false");
            } else {
                console.log(row);
                res.render("search_page", {
                    form: 2,
                    search_theme: postcode,
                    rows: row
                    // user0: row[0],
                    // user1: row[1],
                    // user2: row[2],
                    // user3: row[3],
                    // user4: row[4]
                })
            }
        }
    });
    stmt.finalize();
});


app.post('/friend', function(req, res){
    var friend = req.body.friend.trim();

    var stmt = db.prepare("SELECT user_info.username As name, food.name As food, food.flavour as flavour FROM user_info JOIN food ON user_info.username = food.owner WHERE user_info.username = $friend ");

    stmt.all({$friend: friend}, function(err, row){
        if(err){
            console.log("err->", err);
            res.send("false");
        } else {
            if(row == undefined){
                res.send("false");
            } else {
                console.log(row);
                var stmt2 = db.prepare("SELECT COUNT(*) as number FROM food WHERE food.owner = $friend");
                stmt2.all({$friend: friend}, function(err, food_num){
                    if(err){
                        console.log("err->", err);
                        res.send("false");
                    } else {
                        if(food_num == undefined){
                            res.send("false");
                        } else {
                            console.log(food_num);
                            res.render("search_page", {
                                form: 3,
                                search_theme: friend,
                                rows: row,
                                food_num: food_num
                            });
                        }
                    }
                });
                stmt2.finalize();
                // res.render("search_page", {
                    // form: 3,
                    // search_theme: friend,
                    // rows: row
                    // user0: row[0],
                    // user1: row[1],
                    // user2: row[2],
                    // user3: row[3],
                    // user4: row[4]
                // })
            }
        }
    });
    stmt.finalize();
});






/*
app.get('/', function(req, res){
    res.send('hello world!');
});

var server = app.listen(3000, function(){
    var host = server.address().address;
    var port = server.address().port;
    console.log(host);
    console.log("example app listening at http://%s:%s", host, port);
});

start();

// Start the http service. Accept only requests from localhost, for security.
function start() {
    if (! checkSite()) return;
    types = defineTypes();
    banned = [];
    banUpperCase("./public/", "");
    var service = http.createServer(handle);
    service.listen(port, "localhost");
    var address = "http://localhost";
    if (port != 80) address = address + ":" + port;
    console.log("Server running at", address);
}

// Check that the site folder and index page exist.
function checkSite() {
    var path = "./public";
    var ok = fs.existsSync(path);
    if (ok) path = "./public/index.html";
    if (ok) ok = fs.existsSync(path);
    if (! ok) console.log("Can't find", path);
    return ok;
}

// Serve a request by delivering a file.
function handle(request, response) {
    var url = request.url.toLowerCase();

    //added url validation
    if (url_invalid(url)) return fail(response, NotFound, "URL is invalid");
    if (url.endsWith("/")) url = url + "index.html";
    if (isBanned(url)) return fail(response, NotFound, "URL has been banned");
    var type = findType(url);
    if (type == null) return fail(response, BadType, "File type unsupported");
    if (type == 0){
        var otype = "text/html";
        var ntype = "application/xhtml+xml";
        var header = request.headers.accept;
        var accepts = header.split(",");
        if (accepts.indexOf(ntype) >= 0)
            type = ntype;
        else 
            type = otype;
    }
    var file = "./public" + url;
    fs.readFile(file, ready);
    function ready(err, content) { deliver(response, type, err, content); }
}

// Forbid any resources which shouldn't be delivered to the browser.
function isBanned(url) {
    for (var i=0; i<banned.length; i++) {
        var b = banned[i];
        if (url.startsWith(b)) return true;
    }
    return false;
}


// Find the content type to respond with, or undefined.
function findType(url) {
    var dot = url.lastIndexOf(".");
    var extension = url.substring(dot + 1);
    return types[extension];
}

// Deliver the file that has been read in to the browser.
function deliver(response, type, err, content) {
    if (err) return fail(response, NotFound, "File not found");
    var typeHeader = { "Content-Type": type };
    response.writeHead(OK, typeHeader);
    response.write(content);
    response.end();
}

// Give a minimal failure response to the browser
function fail(response, code, text) {
    var textTypeHeader = { "Content-Type": "text/plain" };
    response.writeHead(code, textTypeHeader);
    response.write(text, "utf8");
    response.end();
}



// The most common standard file extensions are supported, and html is
// delivered as "application/xhtml+xml".  Some common non-standard file
// extensions are explicitly excluded.  This table is defined using a function
// rather than just a global variable, because otherwise the table would have
// to appear before calling start().  NOTE: add entries as needed or, for a more
// complete list, install the mime module and adapt the list it provides.
function defineTypes() {
    var types = {
        html : "application/xhtml+xml",//"text/html",
        css  : "text/css",
        js   : "application/javascript",
        mjs  : "application/javascript", // for ES6 modules
        png  : "image/png",
        gif  : "image/gif",    // for images copied unchanged
        jpeg : "image/jpeg",   // for images copied unchanged
        jpg  : "image/jpeg",   // for images copied unchanged
        svg  : "image/svg+xml",
        json : "application/json",
        pdf  : "application/pdf",
        txt  : "text/plain",
        ttf  : "application/x-font-ttf",
        woff : "application/font-woff",
        aac  : "audio/aac",
        mp3  : "audio/mpeg",
        mp4  : "video/mp4",
        webm : "video/webm",
        ico  : "image/x-icon", // just for favicon.ico
        xhtml: undefined,      // non-standard, use .html
        htm  : undefined,      // non-standard, use .html
        rar  : undefined,      // non-standard, platform dependent, use .zip
        doc  : undefined,      // non-standard, platform dependent, use .pdf
        docx : undefined,      // non-standard, platform dependent, use .pdf
    }
    return types;
}

*/