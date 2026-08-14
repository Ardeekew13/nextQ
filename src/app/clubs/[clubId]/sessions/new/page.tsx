"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NewSessionRedirect() {
	const params = useParams<{ clubId: string }>();
	const router = useRouter();

	useEffect(() => {
		router.replace(`/dashboard/clubs/${params.clubId}/sessions/new`);
	}, [params.clubId, router]);

	return null;
}
