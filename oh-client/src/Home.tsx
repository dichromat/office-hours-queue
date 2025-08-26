import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

function Home() {
    const [message, setMessage] = useState("");
    const [socketMessage, setSocketMessage] = useState("")

    const [position, setPosition] = useState(0);

    const [idToken, setIdToken] = useState("")

    const [nameInput, setNameInput] = useState("");
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value)

    const socketRef = useRef<Socket | null>(null)

    const [inQueue,setInQueue] = useState(false)

    const handleJoinQueue = async () => {
      try {
        const response = await fetch("/api/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: nameInput,
            idToken: idToken,
          }),
        });
  
        const data = await response.json();
  
        if (data.success) {
          setInQueue(true)
          setMessage("")
        } 
        else if (data.error) {
          if (data.error == "Already In Queue") {
            setMessage("You are already in the queue.")
          }
          else if (data.error == "Email is not a CMU address") {
            setMessage("Only CMU emails are permitted. Please login again.")
            setIdToken("")
          }
          else {
            setMessage("An error occured, please try again.");
          }
        }
        else {
          setMessage("Something went wrong, please try again.");
        }
      } catch (error) {
        console.error(error);
        setMessage("Network error, please try again.");
      }
    };

    const handleQueryPosition = () => {
      socketRef.current = socketRef.current || io();
      const socket = socketRef.current

      socket.on("connect", () => {
          console.log("Connected:", socket.id)

          socket.emit("register", {idToken: idToken})
      })

      socket.on("positionUpdate", (res) => {
          if (res.position) {
              console.log("Recieved position:", res.position)
              setPosition(res.position)
              setSocketMessage("")
          }
          else {
              if (res.message && res.message == "Out of CMU") {
                setSocketMessage("Only CMU emails are permitted. Please login again.")
                setIdToken("")
                socketRef.current?.disconnect()
                socketRef.current = null
                setPosition(0)
                setInQueue(false)
              }
              else {
                setSocketMessage("You are not or no longer in the queue.")
                socketRef.current?.disconnect()
                socketRef.current = null
                setPosition(0)
                setInQueue(false)
              }
          }
      })
    }

    const handleAuth = async () => window.location.href = "/auth/google";

    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("idToken");
      if (token) {
        setIdToken(token);
      }
    }, []);
    
  
    return (
      <div className="container-fluid">
        <div className="row mb-3">
          <h1>21241 Office Hours Queue</h1>
        </div>
        <div className="row">
          <div className="h3">
              Please login with your CMU email:
          </div>
        </div>
        <button type="button" onClick={handleAuth} disabled={idToken != ""} className={idToken ? "btn btn-success col-2 mb-5" : "btn btn-primary col-2 mb-5"}>
            {!idToken ? <>Login with Google</> : <>Logged in!</>}
          </button>
        <div className="row">
          <div className="h3">
            Once logged in, you can join the queue:
          </div>
          <div className="input-group mb-2" id="name-input">
            <span className="input-group-text">Name</span>
            <input type="text" onChange={handleNameChange} className="form-control" placeholder="Enter your name here..."></input>
          </div>
          <div className="col-5">
          <button type="button" onClick={handleJoinQueue} disabled={inQueue} className={inQueue ? "btn btn-success col-5 mb-2" : "btn btn-primary col-5 mb-2"}>
            {!inQueue ? <>Join Queue</> : <>Queue Joined!</>}
          </button>
          </div>
          <div className="row mb-5">{message && <p>{message}</p>}</div>
          <div className="row">
            <div className="h3">Once in the queue, click here to view your line position in real time:</div>
            <div className="col-5">
            {position == 0 && <button type="button" onClick={handleQueryPosition} className="btn btn-primary mb-2 col-5">
              Check My Position
            </button>}
            {position > 0 && <button type="button" onClick={handleQueryPosition} className="btn btn-success disabled mb-2 col-5">
              Connected!
            </button>}
            <div className="row mb-5">{socketMessage && <p>{socketMessage}</p>}</div>
            </div>
          </div>
          <div className="row text-center">
            <h3>There are</h3>
            {position>0 ? <h1 className="display-1">{position-1}</h1> : <h1 className="display-1">???</h1>}
            <h3>people ahead of you</h3>
          </div>
        </div>
      </div>
    );
}

export default Home