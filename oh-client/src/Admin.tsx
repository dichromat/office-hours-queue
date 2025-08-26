import { useState } from "react"

type Student = { name: string; email: string };

function Admin() {
    const [password, setPassword] = useState("")
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)

    const [token, setToken] = useState("")

    const [message, setMessage] = useState("")
    const [queue, setQueue] = useState<Student[]>([])

    const [removeIndex, setRemoveIndex] = useState(0)
    const handleIndexChange = (e: React.ChangeEvent<HTMLInputElement>) => setRemoveIndex(parseInt(e.target.value, 10))

    const handlePasswordSubmit = async () => {
        try {
            const response = await fetch("/api/admin/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                password: password
              }),
            });
      
            const data = await response.json();
      
            if (data.success) {
                if (data.token) {
                    setMessage("Login sucessful!");
                    setToken(data.token)
                }
                else if (data.error) {
                    //Only current error is incorrect password
                    setMessage("Incorrect password, please try again.")
                }
                else {
                    setMessage("Login not succesful, please try again.");
                }
            }
            else {
                throw new Error("Server connection failed")
            }
          } catch (error) {
            console.error(error);
            setMessage("Network error, please try again.");
          }
        }

    const handleGetQueue = async () => {
        try {
            const response = await fetch("/api/admin/queue", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                token: token
              }),
            });
      
            const data = await response.json();
      
            if (data.success) {
                if (data.queue) {
                    setQueue(data.queue)
                }
                else if (data.error) {
                    console.log("Server-given error:", data.error)
                }
            }
            else {
                throw new Error("Server connection failed")
            }
          } catch (error) {
            console.error(error);
          }
        };

        const handleFinish = async () => {
            try {
                const response = await fetch("/api/admin/finish", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    token: token
                  }),
                });
          
                const data = await response.json();
          
                if (data.success) {
                    if (data.queue) {
                        setQueue(data.queue)
                    }
                    else if (data.error) {
                        console.log("Server-given error:", data.error)
                    }
                }
                else {
                    throw new Error("Server connection failed")
                }
              } catch (error) {
                console.error(error);
            }
        }

        const handleRemove = async () => {
            try {
                const response = await fetch("/api/admin/deleteByIndex", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    token: token,
                    index: removeIndex
                  }),
                });
          
                const data = await response.json();
          
                if (data.success) {
                    if (data.queue) {
                        setQueue(data.queue)
                    }
                    else if (data.error) {
                        console.log("Server-given error:", data.error)
                    }
                }
                else {
                    throw new Error("Server connection failed")
                }
              } catch (error) {
                console.error(error);
            }
        }
  
    return (
    <div className="container-fluid">
        <div className="row">
            <div className="h3">
                To make admin request, complete the form below:
            </div>
            <div className="input-group mb-2" id="email-input">
                <span className="input-group-text">Password</span>
                <input type="password" onChange={handlePasswordChange} className="form-control" placeholder="Enter password here..."></input>
            </div>
            <div className="col-3">
            <button type="button" onClick={handlePasswordSubmit} className="btn btn-primary">
              Login
            </button>
          </div>
        </div>
        <div className="row mb-5">{message && <p>{message}</p>}</div>
        <ul className="list-group mb-2">
            <li key={-1} className="list-group-item">
                <div className="row">
                    <div className="col-2">
                        <b>Index</b>
                    </div>
                    <div className="col-5">
                        <b>Name</b>
                    </div>
                    <div className="col-5">
                        <b>Email</b>
                    </div>
                </div>
            </li>
        {queue.map((item, index) => (
            <li key={index} className="list-group-item">
                <div className="row">
                    <div className="col-2">
                        {index+1}
                    </div>
                    <div className="col-5">
                        {item.name}
                    </div>
                    <div className="col-5">
                        {item.email}
                    </div>
                </div>
            </li>
        ))}
        </ul>
        <div className="row mb-2">
            <button type="button" onClick={handleGetQueue} className="btn btn-primary col-2">
                Get/Update Queue
            </button>
        </div>
        {queue && 
            <div className="row mb-5">
                <button type="button" onClick={handleFinish} className="btn btn-primary col-2">
                    Clear Top Student
                </button>
            </div>
        }
        {queue && 
            <div className="row">
                <h3>Enter index to remove:</h3>
                <div className="input-group mb-2">
                    <span className="input-group-text">Password</span>
                    <input type="number" onChange={handleIndexChange} className="form-control" placeholder="Enter index here..."></input>
                </div>
                <button type="button" onClick={handleRemove} className="btn btn-primary col-2">
                    Remove Index
                </button>
            </div>
        }




    </div>
    )
}

export default Admin