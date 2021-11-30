import type { NextPage } from "next";
import Head from "next/head";
import Button from "@/components/Button";

const Home: NextPage = () => (
  <div>
    <Head>
      <title>Create Next App</title>
      <meta name="description" content="Generated by create next app" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <h1>홈 페이지</h1>
    <Button>Click Me!</Button>
  </div>
);

export default Home;
