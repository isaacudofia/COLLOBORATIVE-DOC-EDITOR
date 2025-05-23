import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "../../generated/prisma/client.js";
dotenv.config();

//CREATE AM INSTANCE OF PRISMA CLIENT
const prisma = new PrismaClient();

//USER REGISTER CONTROLLER
export const register = async (req, res) => {
  const { email, password, name } = req.body;
  if (!email && !password)
    return res.status(400).json({ message: "Email and password required" });
  try {
    //CHECK IF A USER WITH EMAIL EXIST IN DATABASE SINCE EMAIL IS UNIQUE IN DB MODEL
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res
        .status(400)
        .json({ message: "Email exist, try another email..." });

    //HASH OR ENCRYPT USER PASSWORD FOR SECURIRY BEFORE ADDING TO DB
    const hashedPassword = await bcrypt.hash(password, 10);

    //CREATE A USER IN THE DATABASE
    const createdUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    //DON'T DISPLAY USER HASHED PASSWORD FOR SECURITY
    const { password: _, ...userFetchedWithoutPassword } = createdUser;

    res.status(201).json({
      message: "User Created/Registered Successfully...",
      data: userFetchedWithoutPassword,
    });
  } catch (error) {
    res.status(404).json({
      message: "An error occured while registering user",
      error: error.message,
    });
  }
};

//USER LOGIN CONTROLLER
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email && !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const findUser = await prisma.user.findUnique({ where: { email } });
    if (!findUser)
      return res
        .status(400)
        .json({ message: "User does not exist, please sign up..." });

    const hashedPassword = findUser.password;

    //DE-ENCRYPT THE PASSWORD FOR CHECK IN THE DATABASE
    const correctPassword = await bcrypt.compare(password, hashedPassword);

    if (!correctPassword)
      return res
        .status(400)
        .json({ message: "Invalid credentials when logging in user" });

    //GENERATE SIGNED TOKEN FOR MIDDLEWARE TO USE AND PROTECT SOME ROUTES
    const token = jwt.sign(
      { userID: findUser.id, userEmail: findUser.email },
      process.env.JWT_PRIVATE_KEY,
      {
        expiresIn: "1h",
      }
    );

    //DON'T DISPLAY USER HASHED PASSWORD FOR SECURITY
    const { password: _, ...userFetchedWithoutPassword } = findUser;

    //ALL CREDENTIALS (EMAIL AND PASSWORD) RESPONSES
    res.status(200).json({
      message: "User Logged-in Successfully...",
      token,
      data: userFetchedWithoutPassword,
    });
  } catch (error) {
    res.status(404).json({
      message: "An error occured while logging-in user",
      error: error.message,
    });
  }
};
