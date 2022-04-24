const User = require('../models/User');

const UserOTPVerification = require('../models/UserOTPVerification');

const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const otpGenerator = require('otp-generator');

const nodemailer = require('nodemailer');

exports.getNone = (req, res, next) => {
    if (this.isAuth) {
        res.redirect('/home');
    }
    else {
        res.redirect('/login');
    }
};

exports.getLogin = (req, res, next) => {
    res.render('auth/login', {
        pageTitle: 'Login',
        username: '',
        password: '',
        warningSignIn: '',
        infoSignIn: '',
        warningSignUp: '',
        containerClass: ''
    });
};

exports.postRegisterUser = (req, res, next) => {

    let { email } = req.body;

    email = email.trim();

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.render('auth/login', {
            pageTitle: 'Login',
            username: '',
            password: '',
            warningSignIn: '',
            infoSignIn: '',
            warningSignUp: 'Invalid email address!',
            containerClass: 'sign-up-mode'
        });
    }
    else {
        User.find({ email: email }, (err, docs) => {
            if (err) {
                res.render('auth/login', {
                    pageTitle: 'Login',
                    username: '',
                    password: '',
                    warningSignIn: '',
                    infoSignIn: '',
                    warningSignUp: err,
                    containerClass: 'sign-up-mode'
                });
            }
            else {
                if(docs.length===0)
                {
                    UserOTPVerification.find({email:email},(err,otpuser)=>{
                        if (otpuser.length === 0) {
                            sendOTPVerificationEmail(email, res, () => {
                                res.render('auth/verify', {
                                    pageTitle: 'Verify your email',
                                    email: email,
                                    info: "",
                                    warning: ""
                                });
                            });
                        }
                        else{
                            UserOTPVerification.deleteMany({ email: email }, () => {
                                sendOTPVerificationEmail(email, res, () => {
                                    res.render('auth/verify', {
                                        pageTitle: 'Verify your email',
                                        email: email,
                                        info: "OTP has been sent to your email.",
                                        warning: ""
                                    });
                                });
                            });
                        }
                    });
                }
                else
                {
                    res.render('auth/login', {
                        pageTitle: 'Login',
                        username: '',
                        password: '',
                        warningSignIn: '',
                        infoSignIn: '',
                        warningSignUp: 'User already exists',
                        containerClass: 'sign-up-mode'
                    });
                }
            }
        });
    }
}

exports.postSignInUser = (req, res, next) => {

    let { username, password } = req.body;

    username = username.trim();
    password = password.trim();

    if (username === '' || password == "") {
        res.render('auth/login', {
            pageTitle: 'Login',
            username: '',
            password: '',
            warningSignIn: 'Empty input fields!',
            infoSignIn: '',
            warningSignUp: '',
            containerClass: 'sign-in-mode'
        });
    }
    else {
        User.findOne({ username: username }, (err, docs) => {
            if (err) {
                res.render('auth/login', {
                    pageTitle: 'Login',
                    username: '',
                    password: '',
                    warningSignIn: '',
                    infoSignIn: '',
                    warningSignUp: err,
                    containerClass: 'sign-up-mode'
                });
            }
            else {
                if (docs === null) {
                    res.render('auth/login', {
                        pageTitle: 'Login',
                        username: '',
                        password: '',
                        warningSignIn: 'Username doesnt exists',
                        infoSignIn: '',
                        warningSignUp: '',
                        containerClass: ''
                    });
                }
                else {
                    bcrypt.compare(password, docs.password, (err, result) => {
                        if (err) {
                            res.render('auth/login', {
                                pageTitle: 'Login',
                                username: '',
                                password: '',
                                warningSignIn: '',
                                infoSignIn: '',
                                warningSignUp: err,
                                containerClass: 'sign-up-mode'
                            });
                        }
                        else {
                            if (result) {
                                const token = docs.generateAuthToken();
                                res.cookie("jwt", token, {
                                    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                                    httponly: true
                                });
                                res.redirect('/home');
                            }
                            else {
                                res.render('auth/login', {
                                    pageTitle: 'Login',
                                    username: '',
                                    password: '',
                                    warningSignIn: 'Wrong password',
                                    infoSignIn: '',
                                    warningSignUp: '',
                                    containerClass: 'sign-in-mode'
                                });
                            }
                        }
                    });
                }
            }
        })
    }
};

exports.postVerifyUser = (req, res, next) => {
    try {
        let { otp, email } = req.body

        otp = otp.trim();
        email = email.trim();

        if (!email || !otp) {
            res.render('auth/verify', {
                pageTitle: 'Verify your email',
                email: email,
                info: "",
                warning: "Enter non empty details."
            });
        }
        else {
            UserOTPVerification.find({ email: email }, (err, docs) => {
                if (docs.length <= 0) {
                    res.render('auth/verify', {
                        pageTitle: 'Verify your email',
                        email: email,
                        info: "",
                        warning: "Account has been verified earlier."
                    });
                }
                else {
                    const { expiredAt } = docs[0];
                    const hashedOtp = docs[0].otp;

                    if (expiredAt < Date.now()) {
                        res.render('auth/verify', {
                            pageTitle: 'Verify your email',
                            email: email,
                            info: "",
                            warning: "OTP has expired."
                        });
                    } else {
                        bcrypt.compare(otp, hashedOtp, (err, validOtp) => {
                            if (!validOtp) {
                                res.render('auth/verify', {
                                    pageTitle: 'Verify your email',
                                    email: email,
                                    info: "",
                                    warning: "Invalid OTP."
                                });
                            }
                            else {
                                UserOTPVerification.deleteMany
                                    ({ email: email }, () => {
                                        res.render('auth/details', {
                                            pageTitle: 'Details',
                                            email: email,
                                            info: "",
                                            warning: ""
                                        });
                                    });
                            }
                        })
                    }
                }
            })
        }
    }
    catch (error) {
        console.log(error);
        res.render('auth/verify', {
            pageTitle: 'Verify your email',
            email: email,
            info: "",
            warning: "Verification failed."
        });
    }
};

exports.postResendOTP = (req, res, next) => {
    try {
        let { email } = req.body;

        if (!email) {
            res.render('auth/login', {
                pageTitle: 'Login',
                username: '',
                password: '',
                warningSignIn: '',
                infoSignIn: '',
                warningSignUp: 'Enter non empty email!',
                containerClass: 'sign-up-mode'
            });
        }
        else {
            UserOTPVerification.deleteMany({ email: email }, () => {
                sendOTPVerificationEmail(email, res, () => {
                    res.render('auth/verify', {
                        pageTitle: 'Verify your email',
                        email: email,
                        info: "OTP has been sent to your email.",
                        warning: ""
                    });
                });
            });
        }
    }
    catch (error) {
        console.log(error);
        res.render('auth/verify', {
            pageTitle: 'Verify your email',
            email: email,
            info: "",
            warning: "Verification failed."
        });
    }
};



exports.postDetails = (req, res, next) => {

    let { username, email, password, confirm_password } = req.body;

    username = username.trim();
    email = email.trim();
    file = req.file;
    password = password.trim();
    confirm_password = confirm_password.trim();

    if (!(!username || !email || !file || !password || !confirm_password)) {
        if (password !== confirm_password) {
            res.render('auth/details', {
                pageTitle: 'Details',
                email: email,
                info: "",
                warning: "Passwords do not match."
            });
        }
        else if (password.length < 8) {
            res.render('auth/details', {
                pageTitle: 'Details',
                email: email,
                info: "",
                warning: "Password should be atleast 8 characters long."
            });
        }
        else {
            const saltRounds = 10;

            bcrypt.hash(password, saltRounds, (err, hash) => {
                if (err) {
                    console.log(err);
                    res.render('auth/details', {
                        pageTitle: 'Details',
                        email: email,
                        info: "",
                        warning: "Password hashing failed."
                    });
                }
                else {
                    const user = new User({
                        username: username,
                        email: email,
                        password: hash,
                        profilePic: file.filename
                    });
                    user.save((err, docs) => {
                        if (err) {
                            console.log(err);
                            res.render('auth/details', {
                                pageTitle: 'Details',
                                email: email,
                                info: "",
                                warning: "User registration failed."
                            });
                        }
                        else {
                            res.render('auth/login', {
                                pageTitle: 'Login',
                                username: '',
                                password: '',
                                warningSignIn: '',
                                infoSignIn: 'Sign up successful!',
                                warningSignUp: '',
                                containerClass: 'sign-in-mode'
                            });
                        }
                    });
                }
            });
        }
    }
    else {
        console.log("1");
        res.render('auth/details', {
            pageTitle: 'Details',
            email: email,
            info: "",
            warning: "Enter non empty details."
        });
    }
};

exports.isAuth = (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        const verifyUser = jwt.verify(token, process.env.SECRET_KEY);

        // User.fetchUserById(verifyUser._id,(docs)=>{
        //     console.log(docs);
        // });

        next();
    }
    catch (error) {
        res.redirect('/login');
    }
}

exports.postLogOut = (req, res, next) => {
    try {
        res.clearCookie('jwt');
        res.redirect('/login');
    }
    catch (error) {
        res.redirect('/login');
    }
};

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

const sendOTPVerificationEmail = (email, res, cb) => {
    try {
        const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Verify your email",
            html: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
            <div style="margin:50px auto;width:70%;padding:20px 0">
              <div style="border-bottom:1px solid #eee">
                <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Student HUB</a>
              </div>
              <p style="font-size:1.1em">Hi,</p>
              <p>Hope you like our platform. Use the following OTP to complete your Sign Up procedures. OTP is valid for 1 hour.</p>
              <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${otp}</h2>
              <p style="font-size:0.9em;">Regards,<br />Student HUB</p>
              <hr style="border:none;border-top:1px solid #eee" />
              <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
                <p>Student HUB</p>
                <p>IIIT Sri City</p>
                <p>Andhra Pradesh</p>
              </div>
            </div>
          </div>`,
        };

        // hashing the otp
        const saltRounds = 10;

        bcrypt.hash(otp, saltRounds, (err, hash) => {
            if (err) {
                console.log(err);
            }
            else {
                const newotpverification = new UserOTPVerification({
                    email: email,
                    otp: hash,
                    createdAt: Date.now(),
                    expiredAt: Date.now() + 3600000,
                });

                newotpverification.save((err, docs) => {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        transporter.sendMail(mailOptions, () => {
                            console.log("Email sent!");
                            cb();
                        });
                    }

                });
            }
        });
    }
    catch (error) {
        res.redirect('/login');
    };
}




