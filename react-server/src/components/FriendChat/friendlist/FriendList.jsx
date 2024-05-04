import React, { useEffect, useState } from 'react';
import './FriendList.css';
import { useUserStore } from '../../../context/userStore'; // Adjust the path as necessary
import { doc, getDoc, query, collection, where, setDoc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from '../../../firebase/FirebaseFunctions';
import {useChatStore} from '../../../context/chatStore';

const FriendList = ({triggerChatUpdate}) => {
  const { currentUser } = useUserStore();
  const [friends, setFriends] = useState([]);
  const { changeChat } = useChatStore();

  useEffect(() => {
    async function fetchFriendsData() {
      const promises = currentUser.friends.map(async (friendId) => {
        const docRef = doc(db, "users", friendId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
      });
      const friendsData = await Promise.all(promises);
      const sortedFriends = friendsData.filter(Boolean).sort((a, b) => {
        // Assuming the last name is stored under the key 'lastName'
        return a.lastName.localeCompare(b.lastName);
      });
      setFriends(sortedFriends);
    }
  
    if (currentUser && currentUser.friends) {
      fetchFriendsData();
    }
  }, [currentUser]);
  
  const handleSelectFriend = async (friendId) => {
    // Query to find any existing chat between the two users
    const chatsRef = collection(db, "chats");
    const firstQuery = query(chatsRef, where("members", "array-contains", currentUser.id));
    const firstQuerySnapshot = await getDocs(firstQuery);
    
    const chatsWithFriend = firstQuerySnapshot.docs.filter(doc => 
      doc.data().members.includes(friendId)
    );
  
  
    if (chatsWithFriend.length > 0) {
      // Use the first found chat document
      const chatDoc = chatsWithFriend[0];
      const chatId = chatDoc.id;
      await updateDoc(doc(db, "chats", chatId), {
        updatedAt: Date.now()
      })
      const userIDs = [currentUser.id, friendId]
      userIDs.forEach(async id => {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnap = await getDoc(userChatsRef);
        if (userChatsSnap.exists()) {
          const userChatsData = userChatsSnap.data();
          const updatedChats = userChatsData.chats.map(chat => {
            if (chat.chatId === chatId) {
              return { ...chat, updatedAt: Date.now() };
            }
            return chat;
          });
          await updateDoc(userChatsRef, { chats: updatedChats });
        }
      });
      // Fetch friend's data and set the active chat
      const friendDoc = await getDoc(doc(db, "users", friendId));
      const friendData = friendDoc.data();
      changeChat(chatId, { id: friendId, ...friendData });
      triggerChatUpdate(); 
    } else {
      // Create a new chat if it does not exist
      const newChatRef = doc(collection(db, "chats"));
      await setDoc(newChatRef, {
        members: [currentUser.id, friendId],
        messages: []
      });
      const chatId = newChatRef.id;
  
      // Add new chat to each user's 'userchats'
      const userIDs = [currentUser.id, friendId];
      userIDs.forEach(async id => {
        const userChatRef = doc(db, "userchats", id);
        await updateDoc(userChatRef, {
          chats: arrayUnion({
            chatId: chatId,
            receiverId: id === currentUser.id ? friendId : currentUser.id,
            lastMessage: "",
            updatedAt: Date.now()
          })
        });
      });
    }
  };
  
  

  return (
    <div className="friendList">
      
      {friends.map(friend => (
        <div key={friend.id} className="item" onClick={() => handleSelectFriend(friend.id)}>
          <img src={friend.profilePictureLocation || './public/imgs/default_avatar.png'} alt={friend.firstName} />
          <div className='texts'>
            <span>{friend.firstName} {friend.lastName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FriendList;
