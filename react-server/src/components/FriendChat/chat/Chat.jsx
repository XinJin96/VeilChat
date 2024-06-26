import { AuthContext } from '../../../context/AuthContext';
import { useContext, useEffect, useState } from 'react';
import { useUserStore } from '../../../context/userStore';
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore"
import { db } from '../../../firebase/FirebaseFunctions';
import {useChatStore} from '../../../context/chatStore';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
const Chat = ({updateTrigger}) =>{
    const { currentUser, isLoading } = useUserStore();
    const [allChats, setAllChats] = useState([]);
    const { chatId, changeChat } = useChatStore();
    const [chats, setChats] = useState([]);
    const [searchInput, setsearchInput] = useState("");
    const [message, setMessage] = useState("");
    

    useEffect(() => {
      if (!currentUser || !currentUser.id) {
        setMessage("Please refresh your page to enter friendchat.");
        return;
      }
      const unSub = onSnapshot(doc(db, "userchats", currentUser.id), async (res) => {
        const items = res.data().chats;
        const promises = items.map(async (item) => {
          if (!item.receiverId) {
            console.error("Missing receiver ID for item:", item);
            return null;  // Continue to the next item if this one is faulty
          }
          const userDocRef = doc(db, "users", item.receiverId);
          const userDocSnap = await getDoc(userDocRef);
  
          const user = userDocSnap.data();
  
          return { ...item, user };
        });
  
        const chatData = await Promise.all(promises);
        chatData.sort((a, b) => b.updatedAt - a.updatedAt);
  
        setAllChats(chatData);
        setChats(chatData);
      });
  
      return () => unSub();
    }, [currentUser?.id, updateTrigger]);

    if (isLoading || !currentUser) {
        return <div>Loading...Please Refresh your page</div>; 
    }
    if (message) {
      return <div>{message}</div>;
  }
    const navigate = useNavigate();

    useEffect(() => {
      const filteredChats = allChats.filter(chat => 
        chat.user.firstName.toLowerCase().includes(searchInput.toLowerCase()) ||
        chat.user.lastName.toLowerCase().includes(searchInput.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchInput.toLowerCase())
      );
      setChats(filteredChats);
    }, [searchInput, allChats]);
 
    const handleSelectChat = async (chat) => {
      const chatRef = doc(db, "chats", chat.chatId);
      const userChats = chats.map((item) => {
        const { user, ...rest } = item;
        return rest;
      });
  
      const chatIndex = userChats.findIndex(
        (item) => item.chatId === chat.chatId
      );
  
      userChats[chatIndex].isSeen = true;
  
      const userChatsRef = doc(db, "userchats", currentUser.id);
  
      try {
        await updateDoc(chatRef, {
          updatedAt: Date.now(),
        });
        await updateDoc(userChatsRef, {
          chats: userChats,
        });
        changeChat(chat.chatId, chat.user);
        
      } catch (err) {
        console.log(err);
      }
    };

    return (
      <div className="list bg-base-100 shadow-md rounded-lg p-4 h-screen max-h-screen">
        <div className="chatList">
          <div className="userInfo flex items-center mb-4">
            <img src={currentUser.profilePictureLocation || './public/imgs/avatar.png'} alt="User Avatar" className="userAvatar w-12 h-12 rounded-full mr-4" />
            <div className="userName">
              <h2 className="text-xl font-bold">{`${currentUser.firstName} ${currentUser.lastName}`}</h2>
            </div>
          </div>
          <div className="search flex items-center mb-4">
            <div className="searchBar flex-grow">
              <input type="text" placeholder="Search Chat" onChange={(e) => setsearchInput(e.target.value)} className="input input-bordered w-full" />
            </div>
          </div>
          {chats.map(chat => (
            <div
              className={`chatItem flex items-center p-2 rounded-lg mb-2 cursor-pointer ${chat?.isSeen ? 'bg-transparent' : 'bg-primary text-white'}`}
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
            >
              <img src={chat.user.profilePictureLocation || './public/imgs/default_avatar.png'} alt={chat.user.firstName} className="avatar w-10 h-10 rounded-full mr-4" />
              <div className="chatDetails">
                <div className="texts">
                  <span className="font-bold">{chat.user.firstName} {chat.user.lastName}</span>
                </div>
                <div className="chatBottom">
                  <p>{chat.lastMessage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
}

export default Chat;