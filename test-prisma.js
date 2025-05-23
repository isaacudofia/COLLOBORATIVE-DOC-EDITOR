//test-prisma.js
import { PrismaClient } from "./generated/prisma/client.js";
const prisma = new PrismaClient();

const main = async () => {
  try {
    //Create a new user
    const newUser = await prisma.user.create({
      data: {
        email: "test@example.com",
        password: "hashedpassword123", // Will be properly hashed on Day 3
        name: "Test User",
      },
    });
    console.log("Created user:", newUser);

    //Find all users
    const allUsers = await prisma.user.findMany();
    console.log("\nAll users:", allUsers);

    //Find a specific user by email
    const foundUser = await prisma.user.findUnique({
      where: {
        email: "test@example.com",
      },
    });
    console.log("\nFound user:", foundUser);

    //Update the user
    const updatedUser = await prisma.user.update({
      where: { email: "test@example.com" },
      data: { name: "Updated Test User" },
    });
    console.log("\nUpdated user:", updatedUser);

    //Delete the user
    const deletedUser = await prisma.user.delete({
      where: {
        email: "test@example.com",
      },
    });
    console.log("\nDeleted user:", deletedUser);
  } catch (error) {
    console.error("Error during Prisma operation:", error);
  } finally {
    await prisma.$disconnect(); //Disconnect from the database
  }
};

main();
