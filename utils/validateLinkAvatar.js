function isValidAvatarURL(url) {
  const regex = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))$/i;
  return regex.test(url);
}
export default isValidAvatarURL;
