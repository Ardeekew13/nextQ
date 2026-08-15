import { useRouter } from "next/navigation";
import { App } from "antd";
import { useApolloClient } from "@apollo/client";

export function useLogout() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const apolloClient = useApolloClient();

  const logout = () => {
    modal.confirm({
      title: "Log out of NextQ?",
      content: "Any unsaved session draft is kept.",
      okText: "Log out",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          localStorage.removeItem("auth_token");
          await apolloClient.cache.reset();
          router.replace("/login");
          message.success("Signed out");
        } catch (error) {
          message.error("Error signing out");
        }
      },
    });
  };

  return logout;
}
