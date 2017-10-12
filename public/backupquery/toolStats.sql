SELECT pretty_table.eq_name,
	COALESCE(P,0) AS P,
	COALESCE(SU,0) AS SU,
	COALESCE(SD,0) AS SD,
	COALESCE(D,0) AS D,
	COALESCE(E,0) AS E,
	COALESCE(SB,0) AS SB
   
FROM
	(SELECT extended_table.eq_name,
		SUM(P) AS P,
		SUM(SU) AS SU,
		SUM(SD) AS SD,
		SUM(D) AS D,
		SUM(E) AS E,
		SUM(SB) AS SB
	FROM
		(SELECT base_table.*,
			CASE WHEN base_table.stat_id = "P" THEN base_table.duration END AS P,
			CASE WHEN base_table.stat_id = "SU" THEN base_table.duration END AS SU,
			CASE WHEN base_table.stat_id = "SD" THEN base_table.duration END AS SD,
			CASE WHEN base_table.stat_id = "D" THEN base_table.duration END AS D,
			CASE WHEN base_table.stat_id = "E" THEN base_table.duration END AS E,
			CASE WHEN base_table.stat_id = "SB" THEN base_table.duration END AS SB
		FROM
				(SELECT C.eq_name, B.stat_id, 
					SUM(ROUND(TIME_TO_SEC(TIMEDIFF(B.time_out, B.time_in)) /3600,2)) AS duration
				FROM 
					(SELECT eq_id, proc_id
						FROM MES_EQ_PROCESS 
						WHERE proc_id = "NOXE" GROUP BY eq_id) A
				JOIN
					MES_EQ_CSTAT_HEAD B
				ON A.eq_id = B.eq_id
				JOIN
					MES_EQ_INFO C 
				ON A.eq_id = C.eq_id
				WHERE
				DATE(DATE_ADD(B.time_in, INTERVAL -390 MINUTE)) = DATE(DATE_ADD("2017-10-10", INTERVAL -0 MINUTE))
				AND A.proc_id = "NOXE"
				GROUP BY  C.eq_name, B.stat_id) base_table) extended_table
		GROUP BY extended_table.eq_name) pretty_table